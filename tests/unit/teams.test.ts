// Droits dans un espace partagé (famille).
//
// La règle du produit : quelqu'un qui reçoit un lien d'accès, s'inscrit et
// rejoint l'espace peut VOIR les fichiers sans pouvoir les modifier. Il ne
// peut modifier que si le propriétaire lui donne explicitement le droit.
//
// Comme un fichier partagé est UN SEUL fichier — le modifier le modifie pour
// tout le monde — une erreur ici ne se voit pas : la personne modifie, ça
// marche, et personne ne comprend pourquoi le fichier a changé.
//
// Ces tests énoncent surtout les INTERDICTIONS. Des tests qui ne vérifient
// que ce qui doit marcher passeraient même si tout le monde pouvait tout
// faire.

import { describe, it, expect } from "vitest";
import { canRead, canWrite, canManageMembers, isOwner } from "@/lib/teams";

describe("lecture seule par défaut", () => {
  it("un membre en lecture voit les fichiers", () => {
    expect(canRead("VIEWER")).toBe(true);
  });

  it("un membre en lecture ne peut RIEN modifier", () => {
    // Le cœur de la règle : recevoir le lien et rejoindre ne donne que la
    // consultation.
    expect(canWrite("VIEWER")).toBe(false);
  });

  it("un membre en lecture ne peut pas gérer les autres membres", () => {
    expect(canManageMembers("VIEWER")).toBe(false);
    expect(isOwner("VIEWER")).toBe(false);
  });
});

describe("droit d'écriture accordé explicitement", () => {
  it("un membre passé en édition peut modifier", () => {
    expect(canWrite("EDITOR")).toBe(true);
    expect(canRead("EDITOR")).toBe(true);
  });

  it("mais il ne peut toujours pas gérer les membres", () => {
    // Donner le droit de modifier un fichier ne doit pas donner celui
    // d'inviter des gens ou de promouvoir quelqu'un.
    expect(canManageMembers("EDITOR")).toBe(false);
    expect(isOwner("EDITOR")).toBe(false);
  });
});

describe("gestion de l'espace", () => {
  it("un administrateur d'espace gère les membres", () => {
    expect(canManageMembers("ADMIN")).toBe(true);
    expect(canWrite("ADMIN")).toBe(true);
  });

  it("mais il n'est pas le propriétaire", () => {
    expect(isOwner("ADMIN")).toBe(false);
  });

  it("le propriétaire a tout", () => {
    expect(canRead("OWNER")).toBe(true);
    expect(canWrite("OWNER")).toBe(true);
    expect(canManageMembers("OWNER")).toBe(true);
    expect(isOwner("OWNER")).toBe(true);
  });
});

describe("absence de rôle", () => {
  it("quelqu'un qui n'est pas membre n'a aucun droit", () => {
    // null = aucune adhésion trouvée. Le comportement par défaut doit être
    // « rien », jamais « tout ».
    expect(canRead(null)).toBe(false);
    expect(canWrite(null)).toBe(false);
    expect(canManageMembers(null)).toBe(false);
    expect(isOwner(null)).toBe(false);
  });
});

describe("hiérarchie cohérente", () => {
  const ROLES = ["VIEWER", "EDITOR", "ADMIN", "OWNER"] as const;

  it("écrire implique toujours pouvoir lire", () => {
    // Un rôle qui pourrait modifier sans pouvoir lire serait absurde et
    // révélerait une inversion dans la hiérarchie.
    for (const role of ROLES) {
      if (canWrite(role)) {
        expect(canRead(role), `${role} peut écrire mais pas lire`).toBe(true);
      }
    }
  });

  it("gérer les membres implique toujours pouvoir écrire", () => {
    for (const role of ROLES) {
      if (canManageMembers(role)) {
        expect(canWrite(role), `${role} gère les membres mais ne peut pas écrire`).toBe(true);
      }
    }
  });

  it("exactement un rôle est en lecture seule", () => {
    // Si un deuxième rôle devenait lecture seule sans qu'on le veuille, ou si
    // VIEWER gagnait l'écriture, ce test le signalerait.
    const readOnly = ROLES.filter((r) => canRead(r) && !canWrite(r));
    expect(readOnly).toEqual(["VIEWER"]);
  });

  it("un seul rôle est propriétaire", () => {
    expect(ROLES.filter(isOwner)).toEqual(["OWNER"]);
  });
});
