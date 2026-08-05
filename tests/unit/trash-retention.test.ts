// Rétention de la corbeille.
//
// Ce calcul décide de QUAND un fichier est détruit définitivement. Une erreur
// d'un jour dans un sens rend la corbeille inutile, dans l'autre elle
// supprime des fichiers que l'utilisateur croyait encore récupérables.
//
// C'est le genre de code où une erreur ne se voit qu'une fois les données
// perdues — donc il est testé sur des dates fixes, jamais sur « maintenant ».

import { describe, it, expect } from "vitest";
import {
  TRASH_RETENTION_DAYS,
  trashCutoffDate,
  daysUntilPurge,
} from "@/lib/trash-retention";

const DAY = 24 * 60 * 60 * 1000;
// Date de référence figée : un test qui dépend de l'heure réelle passe le
// matin et échoue le soir.
const NOW = new Date("2026-08-05T12:00:00.000Z");

describe("date limite de purge", () => {
  it("remonte exactement de la durée de rétention", () => {
    const cutoff = trashCutoffDate(NOW);
    expect(NOW.getTime() - cutoff.getTime()).toBe(TRASH_RETENTION_DAYS * DAY);
  });

  it("la durée est de 30 jours, comme les services concurrents", () => {
    // Si quelqu'un change cette valeur, ce test l'oblige à s'en rendre
    // compte et à mettre à jour ce qui est annoncé aux utilisateurs.
    expect(TRASH_RETENTION_DAYS).toBe(30);
  });
});

describe("compte à rebours affiché à l'utilisateur", () => {
  it("un fichier jeté à l'instant a la durée complète devant lui", () => {
    expect(daysUntilPurge(NOW, NOW)).toBe(TRASH_RETENTION_DAYS);
  });

  it("après 10 jours, il en reste 20", () => {
    const deleted = new Date(NOW.getTime() - 10 * DAY);
    expect(daysUntilPurge(deleted, NOW)).toBe(20);
  });

  it("à la veille de l'échéance, il reste 1 jour — pas 0", () => {
    // Erreur classique d'arrondi : afficher « 0 jour » alors que le fichier
    // est encore récupérable pousserait l'utilisateur à croire qu'il est
    // perdu.
    const deleted = new Date(NOW.getTime() - (TRASH_RETENTION_DAYS - 1) * DAY);
    expect(daysUntilPurge(deleted, NOW)).toBe(1);
  });

  it("à l'échéance exacte, le compte tombe à 0", () => {
    const deleted = new Date(NOW.getTime() - TRASH_RETENTION_DAYS * DAY);
    expect(daysUntilPurge(deleted, NOW)).toBe(0);
  });

  it("au-delà de l'échéance, ne descend jamais sous 0", () => {
    // Un nombre négatif s'afficherait tel quel dans l'interface.
    const deleted = new Date(NOW.getTime() - 90 * DAY);
    expect(daysUntilPurge(deleted, NOW)).toBe(0);
  });

  it("sans date de mise à la corbeille, ne renvoie aucun compte à rebours", () => {
    // Mieux vaut n'afficher aucun délai qu'un délai inventé.
    expect(daysUntilPurge(null, NOW)).toBeNull();
  });
});

describe("cohérence entre le compte à rebours et la purge réelle", () => {
  it("tout élément à 0 jour restant est bien au-delà de la date limite", () => {
    // C'est LA garantie qui compte : ce que l'interface annonce comme
    // « supprimé aujourd'hui » doit correspondre à ce que la purge supprime
    // réellement. Sans ce lien, l'affichage et le comportement pourraient
    // diverger sans que personne s'en aperçoive.
    const cutoff = trashCutoffDate(NOW);
    for (const daysAgo of [30, 31, 45, 365]) {
      const deleted = new Date(NOW.getTime() - daysAgo * DAY);
      expect(daysUntilPurge(deleted, NOW)).toBe(0);
      expect(deleted.getTime()).toBeLessThanOrEqual(cutoff.getTime());
    }
  });

  it("tout élément avec des jours restants est en deçà de la date limite", () => {
    const cutoff = trashCutoffDate(NOW);
    for (const daysAgo of [0, 1, 15, 29]) {
      const deleted = new Date(NOW.getTime() - daysAgo * DAY);
      expect(daysUntilPurge(deleted, NOW)).toBeGreaterThan(0);
      expect(deleted.getTime()).toBeGreaterThan(cutoff.getTime());
    }
  });
});
