"use client";

import { useRouter } from "next/navigation";
import { Crown, Shield, Pencil, Eye, UserX } from "lucide-react";

interface Member {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
}

const ROLE_ICON = {
  OWNER: Crown,
  ADMIN: Shield,
  EDITOR: Pencil,
  VIEWER: Eye,
};

const ROLE_LABEL = {
  OWNER: "Propriétaire",
  ADMIN: "Admin",
  EDITOR: "Édition",
  VIEWER: "Lecture",
};

export function TeamMembers({
  teamId,
  currentUserId,
  canManage,
  isOwner,
  members,
}: {
  teamId: string;
  currentUserId: string;
  canManage: boolean;
  isOwner: boolean;
  members: Member[];
}) {
  const router = useRouter();

  async function changeRole(memberId: string, newRole: string) {
    const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) router.refresh();
    else alert("Erreur");
  }

  async function removeMember(memberId: string) {
    if (!confirm("Retirer ce membre ?")) return;
    const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else alert("Erreur");
  }

  return (
    <ul className="space-y-2">
      {members.map((member) => {
        const Icon = ROLE_ICON[member.role];
        const isSelf = member.userId === currentUserId;
        return (
          <li
            key={member.id}
            className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background-tile)] p-3"
          >
            <div className="size-10 rounded-full bg-[var(--background-elevated)] flex items-center justify-center text-sm font-semibold border border-[var(--border)]">
              {(member.name ?? member.email).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {member.name ?? member.email}
                {isSelf && <span className="text-xs text-[var(--foreground-muted)] ms-2">(toi)</span>}
              </p>
              <p className="text-xs text-[var(--foreground-muted)] truncate">{member.email}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-[var(--foreground-muted)]">
              <Icon className="size-3.5" />
              <span>{ROLE_LABEL[member.role]}</span>
            </div>
            {canManage && !isSelf && member.role !== "OWNER" && (
              <div className="flex items-center gap-1">
                <select
                  value={member.role}
                  onChange={(e) => changeRole(member.id, e.target.value)}
                  className="text-xs rounded-lg bg-[var(--background-elevated)] border border-[var(--border)] px-2 py-1"
                >
                  <option value="VIEWER">Lecture</option>
                  <option value="EDITOR">Édition</option>
                  <option value="ADMIN">Admin</option>
                  {isOwner && <option value="OWNER">Transférer propriété</option>}
                </select>
                <button
                  onClick={() => removeMember(member.id)}
                  className="p-1.5 rounded-lg text-[var(--danger)] hover:bg-[var(--background-elevated)]"
                >
                  <UserX className="size-4" />
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
