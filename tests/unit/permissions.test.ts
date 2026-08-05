// Matrice des rôles du back-office.
//
// Un rôle trop permissif ne se voit pas : la personne accède à des pages
// qu'elle ne devrait pas, tout fonctionne, personne ne remarque rien. C'est
// exactement le type de défaut qui reste des mois en production.
//
// Ces tests énoncent les INTERDICTIONS attendues, pas seulement les
// autorisations : un test qui ne vérifie que ce qui doit marcher passerait
// même si tous les rôles avaient tous les droits.

import { describe, it, expect } from "vitest";
import {
  hasPermission,
  canAccessBackoffice,
  getPermissionsForRole,
  type Permission,
} from "@/lib/permissions";

describe("ADMIN", () => {
  it("a toutes les permissions existantes", () => {
    // Référence : l'union de ce que possèdent tous les rôles. Si un rôle
    // gagnait un droit qu'ADMIN n'a pas, ce test le signalerait.
    const everything = new Set<Permission>([
      ...getPermissionsForRole("ADMIN"),
      ...getPermissionsForRole("STAFF_SUPPORT"),
      ...getPermissionsForRole("STAFF_BILLING"),
      ...getPermissionsForRole("STAFF_OPS"),
    ]);
    for (const perm of everything) {
      expect(hasPermission("ADMIN", perm), `ADMIN devrait avoir ${perm}`).toBe(true);
    }
  });

  it("accède au back-office", () => {
    expect(canAccessBackoffice("ADMIN")).toBe(true);
  });
});

describe("un utilisateur simple n'a aucun accès", () => {
  it("ne peut pas entrer dans le back-office", () => {
    expect(canAccessBackoffice("USER")).toBe(false);
  });

  it("n'a aucune permission, même la plus anodine", () => {
    expect(hasPermission("USER", "page.overview")).toBe(false);
    expect(hasPermission("USER", "page.clients")).toBe(false);
    expect(hasPermission("USER", "client.modify")).toBe(false);
  });

  it("un rôle inventé n'ouvre aucune porte", () => {
    // Protège contre un rôle ajouté en base sans être ajouté à la matrice :
    // le comportement par défaut doit être « aucun droit », jamais « tous ».
    expect(canAccessBackoffice("SUPER_ADMIN")).toBe(false);
    expect(hasPermission("SUPER_ADMIN", "staff.write")).toBe(false);
    expect(hasPermission("", "staff.write")).toBe(false);
    expect(getPermissionsForRole("ROLE_INEXISTANT")).toEqual([]);
  });
});

describe("cloisonnement entre rôles staff", () => {
  it("le support ne peut pas modifier un client ni toucher aux paiements", () => {
    expect(hasPermission("STAFF_SUPPORT", "page.tickets")).toBe(true);
    expect(hasPermission("STAFF_SUPPORT", "ticket.reply")).toBe(true);
    // Interdits :
    expect(hasPermission("STAFF_SUPPORT", "client.modify")).toBe(false);
    expect(hasPermission("STAFF_SUPPORT", "payment.write")).toBe(false);
    expect(hasPermission("STAFF_SUPPORT", "staff.write")).toBe(false);
    expect(hasPermission("STAFF_SUPPORT", "page.audit")).toBe(false);
    expect(hasPermission("STAFF_SUPPORT", "storage.write")).toBe(false);
  });

  it("la facturation ne peut pas répondre aux tickets ni gérer le stockage", () => {
    expect(hasPermission("STAFF_BILLING", "payment.write")).toBe(true);
    expect(hasPermission("STAFF_BILLING", "coupon.write")).toBe(true);
    // Interdits :
    expect(hasPermission("STAFF_BILLING", "ticket.reply")).toBe(false);
    expect(hasPermission("STAFF_BILLING", "storage.write")).toBe(false);
    expect(hasPermission("STAFF_BILLING", "staff.write")).toBe(false);
    expect(hasPermission("STAFF_BILLING", "cms.write")).toBe(false);
  });

  it("l'exploitation ne peut pas voir les paiements ni gérer le personnel", () => {
    expect(hasPermission("STAFF_OPS", "storage.write")).toBe(true);
    expect(hasPermission("STAFF_OPS", "page.storage")).toBe(true);
    // Interdits :
    expect(hasPermission("STAFF_OPS", "page.payments")).toBe(false);
    expect(hasPermission("STAFF_OPS", "payment.write")).toBe(false);
    expect(hasPermission("STAFF_OPS", "staff.write")).toBe(false);
    expect(hasPermission("STAFF_OPS", "page.audit")).toBe(false);
  });

  it("aucun rôle non-ADMIN ne peut créer ou modifier du personnel", () => {
    // Le droit le plus sensible : il permettrait de s'auto-promouvoir.
    for (const role of ["STAFF_SUPPORT", "STAFF_BILLING", "STAFF_OPS", "USER"]) {
      expect(hasPermission(role, "staff.write"), `${role} ne doit pas avoir staff.write`).toBe(false);
    }
  });

  it("aucun rôle non-ADMIN ne peut consulter le journal d'audit", () => {
    // Le journal trace les actions du personnel : y donner accès permettrait
    // de vérifier ce qui est surveillé.
    for (const role of ["STAFF_SUPPORT", "STAFF_BILLING", "STAFF_OPS", "USER"]) {
      expect(hasPermission(role, "page.audit"), `${role} ne doit pas voir l'audit`).toBe(false);
    }
  });

  it("tous les rôles staff accèdent au back-office", () => {
    for (const role of ["ADMIN", "STAFF_SUPPORT", "STAFF_BILLING", "STAFF_OPS"]) {
      expect(canAccessBackoffice(role), `${role} doit accéder au back-office`).toBe(true);
    }
  });

  it("tous les rôles staff voient au moins la vue d'ensemble", () => {
    // Sinon un membre du personnel atterrirait sur une page interdite après
    // connexion, et serait renvoyé en boucle.
    for (const role of ["ADMIN", "STAFF_SUPPORT", "STAFF_BILLING", "STAFF_OPS"]) {
      expect(hasPermission(role, "page.overview"), `${role} doit voir /admin`).toBe(true);
    }
  });
});
