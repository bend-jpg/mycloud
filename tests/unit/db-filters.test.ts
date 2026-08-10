// Filtre de masquage des envois non confirmés.
//
// Ce test existe à cause d'une régression réelle : le filtre, ajouté pour que
// les envois interrompus ne laissent pas de fichiers fantômes, masquait aussi
// le fichier à la route /complete — celle qui doit justement le confirmer.
// Résultat : TOUS les envois échouaient avec « Échec de la finalisation », et
// rien dans le message n'évoquait un filtre.
//
// L'échappatoire (mentionner `uploadPending` dans le filtre) est ce qui rend
// la route possible. Elle est donc testée explicitement.

import { describe, it, expect } from "vitest";
import { hideIncompleteUploads } from "@/lib/db-filters";

describe("masquage par défaut", () => {
  it("ajoute le filtre quand l'appelant n'en parle pas", () => {
    const out = hideIncompleteUploads({ where: { ownerId: "u1" } });
    expect(out.where).toEqual({ ownerId: "u1", uploadPending: false });
  });

  it("fonctionne aussi sans filtre du tout", () => {
    // Cas réel : `count()` sans argument.
    const out = hideIncompleteUploads({} as { where?: Record<string, unknown> });
    expect(out.where).toEqual({ uploadPending: false });
  });

  it("ne détruit pas les autres critères", () => {
    const out = hideIncompleteUploads({
      where: { ownerId: "u1", isTrash: false, folderId: null },
    });
    expect(out.where).toEqual({
      ownerId: "u1",
      isTrash: false,
      folderId: null,
      uploadPending: false,
    });
  });

  it("conserve les options autres que le filtre", () => {
    const out = hideIncompleteUploads({ where: { ownerId: "u1" }, take: 10, orderBy: { name: "asc" } } as {
      where?: Record<string, unknown>;
      take?: number;
      orderBy?: unknown;
    });
    expect(out.take).toBe(10);
    expect(out.orderBy).toEqual({ name: "asc" });
  });
});

describe("échappatoire — sans elle, aucun envoi ne peut être finalisé", () => {
  it("`uploadPending: undefined` désactive le filtre", () => {
    // C'est exactement ce qu'écrit /api/files/[id]/complete : « peu importe
    // l'état ». Si ce comportement changeait, tous les envois casseraient à
    // nouveau.
    const args = { where: { id: "f1", ownerId: "u1", uploadPending: undefined } };
    const out = hideIncompleteUploads(args);
    expect(out.where).toEqual({ id: "f1", ownerId: "u1", uploadPending: undefined });
    expect(out.where!.uploadPending).toBeUndefined();
  });

  it("`uploadPending: true` cherche justement les envois en attente", () => {
    // Utilisé par la maintenance pour supprimer ceux qui n'arriveront jamais.
    const out = hideIncompleteUploads({ where: { uploadPending: true } });
    expect(out.where).toEqual({ uploadPending: true });
  });

  it("`uploadPending: false` explicite reste inchangé", () => {
    const out = hideIncompleteUploads({ where: { uploadPending: false } });
    expect(out.where).toEqual({ uploadPending: false });
  });
});

describe("l'objet d'origine n'est pas modifié", () => {
  it("le filtre est recopié, pas muté", () => {
    // Prisma réutilise parfois les objets d'arguments ; les muter produirait
    // des effets de bord entre requêtes, très difficiles à diagnostiquer.
    const args = { where: { ownerId: "u1" } };
    hideIncompleteUploads(args);
    expect(args.where).toEqual({ ownerId: "u1" });
  });
});
