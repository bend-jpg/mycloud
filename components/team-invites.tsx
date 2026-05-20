"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Trash2 } from "lucide-react";

interface Invite {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
}

export function TeamInvites({ teamId, invites }: { teamId: string; invites: Invite[] }) {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(`${baseUrl}/invite/${token}`);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  async function revoke(id: string) {
    if (!confirm("Annuler cette invitation ?")) return;
    const res = await fetch(`/api/teams/${teamId}/invites/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <ul className="space-y-2">
      {invites.map((inv) => (
        <li
          key={inv.id}
          className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background-tile)] p-3"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{inv.email}</p>
            <p className="text-xs text-[var(--foreground-muted)]">
              {inv.role} · expire le {new Date(inv.expiresAt).toLocaleDateString()}
            </p>
          </div>
          <button onClick={() => copyLink(inv.token)} className="btn-ghost text-xs">
            {copied === inv.token ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied === inv.token ? "Copié" : "Copier le lien"}
          </button>
          <button
            onClick={() => revoke(inv.id)}
            className="p-1.5 rounded-lg text-[var(--danger)] hover:bg-[var(--background-elevated)]"
          >
            <Trash2 className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
