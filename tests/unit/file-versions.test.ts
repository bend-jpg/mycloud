// Décision de suppression des versions de fichiers.
//
// Ce code choisit quels octets sont détruits définitivement. La fonction de
// décision est volontairement pure — aucune base, aucun stockage — pour être
// testable exhaustivement.
//
// La propriété la plus importante est la dernière du fichier : AUCUN plan,
// quelle que soit la combinaison, ne doit désigner la clé du fichier vivant.
// C'est le piège qui aurait détruit le contenu actuel des fichiers.

import { describe, it, expect } from "vitest";
import {
  planVersionCleanup,
  isExpired,
  hoursUntilVersionPurge,
  retentionAnchor,
  VERSION_RETENTION_HOURS,
  MAX_ARCHIVED_VERSIONS,
  type VersionRow,
} from "@/lib/file-versions";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-08-05T12:00:00.000Z");
const LIVE = "users/u1/rapport.docx";

function v(over: Partial<VersionRow> & { id: string }): VersionRow {
  return {
    storageKey: `${LIVE}.v1`,
    storageBackendId: "backend-1",
    isCurrent: false,
    uploadedAt: NOW,
    supersededAt: null,
    ...over,
  };
}

describe("règle de conservation", () => {
  it("garde une seule version précédente, pendant 72 h", () => {
    // Ces deux valeurs sont la règle décidée. Les changer doit être un acte
    // conscient, pas un effet de bord.
    expect(MAX_ARCHIVED_VERSIONS).toBe(1);
    expect(VERSION_RETENTION_HOURS).toBe(72);
  });

  it("le délai part du moment où la version a cessé d'être courante", () => {
    const uploaded = new Date(NOW.getTime() - 100 * HOUR);
    const superseded = new Date(NOW.getTime() - 1 * HOUR);
    expect(retentionAnchor({ uploadedAt: uploaded, supersededAt: superseded })).toEqual(superseded);
  });

  it("à défaut, se rabat sur la date d'envoi (lignes créées avant le champ)", () => {
    const uploaded = new Date(NOW.getTime() - 10 * HOUR);
    expect(retentionAnchor({ uploadedAt: uploaded, supersededAt: null })).toEqual(uploaded);
  });

  it("échéance : 71 h encore valide, 72 h échue", () => {
    const at = (h: number) => ({ uploadedAt: NOW, supersededAt: new Date(NOW.getTime() - h * HOUR) });
    expect(isExpired(at(71), NOW)).toBe(false);
    expect(isExpired(at(72), NOW)).toBe(true);
    expect(isExpired(at(73), NOW)).toBe(true);
  });

  it("compte à rebours cohérent avec l'échéance", () => {
    const at = (h: number) => ({ uploadedAt: NOW, supersededAt: new Date(NOW.getTime() - h * HOUR) });
    expect(hoursUntilVersionPurge(at(0), NOW)).toBe(72);
    expect(hoursUntilVersionPurge(at(70), NOW)).toBe(2);
    expect(hoursUntilVersionPurge(at(72), NOW)).toBe(0);
    expect(hoursUntilVersionPurge(at(200), NOW)).toBe(0);
  });
});

describe("la version courante est intouchable", () => {
  it("n'est jamais supprimée, même très ancienne", () => {
    const versions = [
      v({ id: "cur", isCurrent: true, storageKey: LIVE, uploadedAt: new Date(NOW.getTime() - 5000 * HOUR) }),
    ];
    const plan = planVersionCleanup(versions, LIVE, NOW);
    expect(plan.rowsOnly).toEqual([]);
    expect(plan.withObjects).toEqual([]);
  });
});

describe("doublon obsolète : ligne supprimée, objet préservé", () => {
  it("une ligne non courante pointant vers la clé VIVE ne fait perdre aucun octet", () => {
    // C'est exactement l'état produit par un deuxième enregistrement.
    // Supprimer cet objet détruirait le contenu actuel du fichier.
    const versions = [
      v({ id: "cur", isCurrent: true, storageKey: LIVE }),
      v({ id: "stale", isCurrent: false, storageKey: LIVE }),
    ];
    const plan = planVersionCleanup(versions, LIVE, NOW);
    expect(plan.rowsOnly).toEqual(["stale"]);
    expect(plan.withObjects).toEqual([]);
  });
});

describe("archives réelles", () => {
  it("une seule archive récente est conservée", () => {
    const versions = [
      v({ id: "cur", isCurrent: true, storageKey: LIVE }),
      v({ id: "a1", storageKey: `${LIVE}.v100`, supersededAt: new Date(NOW.getTime() - 2 * HOUR) }),
    ];
    const plan = planVersionCleanup(versions, LIVE, NOW);
    expect(plan.withObjects).toEqual([]);
    expect(plan.kept?.id).toBe("a1");
  });

  it("trois enregistrements : seule l'avant-dernière version survit", () => {
    // Le cas décrit : je remplace le même fichier 3 fois, je ne garde pas les
    // deux plus anciennes mais uniquement l'avant-dernière.
    const versions = [
      v({ id: "cur", isCurrent: true, storageKey: LIVE }),
      v({ id: "vieille", storageKey: `${LIVE}.v100`, supersededAt: new Date(NOW.getTime() - 3 * HOUR) }),
      v({ id: "recente", storageKey: `${LIVE}.v200`, supersededAt: new Date(NOW.getTime() - 1 * HOUR) }),
    ];
    const plan = planVersionCleanup(versions, LIVE, NOW);
    expect(plan.kept?.id).toBe("recente");
    expect(plan.withObjects.map((x) => x.id)).toEqual(["vieille"]);
  });

  it("une archive de plus de 72 h part, même si c'est la seule", () => {
    const versions = [
      v({ id: "cur", isCurrent: true, storageKey: LIVE }),
      v({ id: "perimee", storageKey: `${LIVE}.v100`, supersededAt: new Date(NOW.getTime() - 80 * HOUR) }),
    ];
    const plan = planVersionCleanup(versions, LIVE, NOW);
    expect(plan.withObjects.map((x) => x.id)).toEqual(["perimee"]);
    expect(plan.kept).toBeNull();
  });

  it("l'ordre en entrée n'influence pas la décision", () => {
    const a = v({ id: "a", storageKey: `${LIVE}.v1`, supersededAt: new Date(NOW.getTime() - 5 * HOUR) });
    const b = v({ id: "b", storageKey: `${LIVE}.v2`, supersededAt: new Date(NOW.getTime() - 1 * HOUR) });
    const cur = v({ id: "cur", isCurrent: true, storageKey: LIVE });
    const p1 = planVersionCleanup([cur, a, b], LIVE, NOW);
    const p2 = planVersionCleanup([b, cur, a], LIVE, NOW);
    expect(p1.kept?.id).toBe("b");
    expect(p2.kept?.id).toBe("b");
    expect(p1.withObjects.map((x) => x.id)).toEqual(["a"]);
    expect(p2.withObjects.map((x) => x.id)).toEqual(["a"]);
  });

  it("un fichier sans aucune version ne produit aucune suppression", () => {
    const plan = planVersionCleanup([], LIVE, NOW);
    expect(plan).toEqual({ rowsOnly: [], withObjects: [], kept: null });
  });
});

describe("après une restauration", () => {
  it("la version qu'on vient de quitter repart pour 72 h", () => {
    // Scénario : le fichier a été modifié il y a 5 jours, puis on restaure
    // une ancienne version aujourd'hui. La version « récente » qu'on vient
    // d'abandonner devient le point de secours — elle ne doit pas être
    // détruite immédiatement sous prétexte qu'elle date de 5 jours.
    const versions = [
      v({ id: "restauree", isCurrent: true, storageKey: LIVE }),
      v({
        id: "travail-recent",
        storageKey: `${LIVE}.v900`,
        uploadedAt: new Date(NOW.getTime() - 120 * HOUR), // 5 jours
        supersededAt: new Date(NOW.getTime() - 1 * HOUR), // vient d'être quittée
      }),
    ];
    const plan = planVersionCleanup(versions, LIVE, NOW);
    expect(plan.withObjects).toEqual([]);
    expect(plan.kept?.id).toBe("travail-recent");
  });
});

describe("PROPRIÉTÉ DE SÛRETÉ — la clé vivante n'est jamais détruite", () => {
  it("aucune combinaison ne désigne l'objet du fichier actuel", () => {
    // Balayage exhaustif de toutes les combinaisons plausibles : courante ou
    // non, clé vivante ou archive, récente ou échue. Si un seul cas laissait
    // passer la clé vivante dans les objets à supprimer, le contenu actuel du
    // fichier serait perdu.
    const keys = [LIVE, `${LIVE}.v1`, `${LIVE}.v2`];
    const ages = [0, 10, 71, 72, 500];
    const versions: VersionRow[] = [];
    let n = 0;
    for (const isCurrent of [true, false]) {
      for (const storageKey of keys) {
        for (const age of ages) {
          versions.push(
            v({
              id: `v${n++}`,
              isCurrent,
              storageKey,
              supersededAt: new Date(NOW.getTime() - age * HOUR),
            }),
          );
        }
      }
    }
    expect(versions.length).toBe(30);

    const plan = planVersionCleanup(versions, LIVE, NOW);
    for (const doomed of plan.withObjects) {
      expect(doomed.storageKey, "un objet à supprimer pointe vers la clé vivante").not.toBe(LIVE);
    }
    // Et aucune ligne courante ne doit figurer dans un lot de suppression.
    const doomedIds = new Set([...plan.rowsOnly, ...plan.withObjects.map((x) => x.id)]);
    for (const ver of versions.filter((x) => x.isCurrent)) {
      expect(doomedIds.has(ver.id), "une version courante est marquée pour suppression").toBe(false);
    }
  });
});
