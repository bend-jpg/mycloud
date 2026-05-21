// Helpers permissions team
import { db } from "./db";
import type { MemberRole } from "@prisma/client";

const ROLE_LEVEL: Record<MemberRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 4,
};

export async function getMembership(teamId: string, userId: string) {
  return db.membership.findUnique({
    where: { teamId_userId: { teamId, userId } },
    include: { team: true },
  });
}

export function canRead(role: MemberRole | null): boolean {
  return role !== null && ROLE_LEVEL[role] >= ROLE_LEVEL.VIEWER;
}
export function canWrite(role: MemberRole | null): boolean {
  return role !== null && ROLE_LEVEL[role] >= ROLE_LEVEL.EDITOR;
}
export function canManageMembers(role: MemberRole | null): boolean {
  return role !== null && ROLE_LEVEL[role] >= ROLE_LEVEL.ADMIN;
}
export function isOwner(role: MemberRole | null): boolean {
  return role === "OWNER";
}

/**
 * Liste les teams (familles) dont l'utilisateur est membre, pour exposer un sélecteur
 * "Partager dans la famille X" dans la liste de fichiers.
 */
export async function getMyTeams(userId: string) {
  const memberships = await db.membership.findMany({
    where: { userId },
    include: { team: { select: { id: true, name: true } } },
    orderBy: { team: { name: "asc" } },
  });
  return memberships.map((m) => ({ id: m.team.id, name: m.team.name }));
}

/**
 * Pour une liste de fichiers donnés (perso de l'utilisateur), retourne pour chaque file
 * la liste des teams (parmi celles de l'utilisateur) qui possèdent une autre File row
 * pointant vers le même storageKey — i.e. les familles avec qui ce fichier est partagé.
 *
 * Optimisé : 1 seul SELECT global puis groupé en mémoire.
 */
export async function computeSharedToTeams(
  userId: string,
  files: { id: string; storageKey: string; storageBackendId: string }[],
): Promise<Record<string, { id: string; name: string }[]>> {
  if (files.length === 0) return {};

  // Teams dont l'utilisateur est membre
  const memberships = await db.membership.findMany({
    where: { userId },
    select: { teamId: true, team: { select: { id: true, name: true } } },
  });
  const myTeamIds = memberships.map((m) => m.teamId);
  if (myTeamIds.length === 0) return {};
  const teamById = new Map(memberships.map((m) => [m.team.id, { id: m.team.id, name: m.team.name }]));

  const keys = Array.from(new Set(files.map((f) => f.storageKey)));
  const refs = await db.file.findMany({
    where: {
      storageKey: { in: keys },
      teamId: { in: myTeamIds },
      isTrash: false,
    },
    select: { storageKey: true, storageBackendId: true, teamId: true },
  });

  const map: Record<string, { id: string; name: string }[]> = {};
  for (const f of files) {
    const teams = refs
      .filter((r) => r.storageKey === f.storageKey && r.storageBackendId === f.storageBackendId && r.teamId)
      .map((r) => teamById.get(r.teamId!))
      .filter((t): t is { id: string; name: string } => !!t);
    // dédoublonner
    const uniq = Array.from(new Map(teams.map((t) => [t.id, t])).values());
    if (uniq.length > 0) map[f.id] = uniq;
  }
  return map;
}
