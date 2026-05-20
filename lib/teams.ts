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
