// Liste lisible des actions team. Server component possible mais on garde la
// possibilité d'ajouter du filtrage côté client plus tard.

import { Upload, Trash2, FolderPlus, FolderMinus, UserPlus, UserMinus, Mail, Move, Activity } from "lucide-react";
import { EmptyState } from "./empty-state";

interface ActivityItem {
  id: string;
  action: string;
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_META: Record<string, { icon: React.ComponentType<{ className?: string }>; verb: string; color: string }> = {
  "team.file.upload": { icon: Upload, verb: "a uploadé", color: "text-emerald-400 bg-emerald-400/10" },
  "team.file.delete": { icon: Trash2, verb: "a supprimé", color: "text-[var(--danger)] bg-[var(--danger)]/10" },
  "team.file.move": { icon: Move, verb: "a déplacé", color: "text-[var(--accent)] bg-[var(--accent)]/10" },
  "team.folder.create": { icon: FolderPlus, verb: "a créé le dossier", color: "text-[var(--secondary)] bg-[var(--secondary)]/10" },
  "team.folder.delete": { icon: FolderMinus, verb: "a supprimé le dossier", color: "text-[var(--danger)] bg-[var(--danger)]/10" },
  "team.member.join": { icon: UserPlus, verb: "a rejoint", color: "text-emerald-400 bg-emerald-400/10" },
  "team.member.leave": { icon: UserMinus, verb: "a quitté", color: "text-[var(--foreground-muted)] bg-[var(--background-elevated)]" },
  "team.member.invite": { icon: Mail, verb: "a invité", color: "text-violet-400 bg-violet-400/10" },
  "team.member.remove": { icon: UserMinus, verb: "a retiré", color: "text-[var(--danger)] bg-[var(--danger)]/10" },
};

export function TeamActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        variant="accent"
        title="Pas encore d'activité"
        description="Les uploads, suppressions, invitations et autres actions des membres apparaîtront ici en temps réel."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((a) => {
        const meta = ACTION_META[a.action] ?? {
          icon: Activity,
          verb: a.action,
          color: "text-[var(--foreground-muted)] bg-[var(--background-elevated)]",
        };
        const Icon = meta.icon;
        const displayName = a.user.name || a.user.email.split("@")[0];
        const target =
          (a.metadata?.fileName as string | undefined) ||
          (a.metadata?.folderName as string | undefined) ||
          (a.metadata?.email as string | undefined) ||
          "";

        return (
          <li
            key={a.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-4 flex items-start gap-3"
          >
            <div className={`shrink-0 size-10 rounded-xl flex items-center justify-center ${meta.color}`}>
              <Icon className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm">
                  <strong className="font-medium">{displayName}</strong>{" "}
                  <span className="text-[var(--foreground-muted)]">{meta.verb}</span>
                  {target && (
                    <>
                      {" "}
                      <span className="font-mono text-xs bg-[var(--background-elevated)] px-1.5 py-0.5 rounded">
                        {target}
                      </span>
                    </>
                  )}
                </p>
                <span className="text-xs text-[var(--foreground-muted)] shrink-0">
                  {relativeTime(a.createdAt)}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `il y a ${days}j`;
  return d.toLocaleDateString();
}
