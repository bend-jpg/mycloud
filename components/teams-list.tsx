"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Users, Briefcase, Plus, X, Loader2, FolderOpen } from "lucide-react";

interface Team {
  id: string;
  name: string;
  type: string;
  role: string;
  memberCount: number;
  fileCount: number;
}

export function TeamsList({
  teams,
  canCreate,
  planName,
}: {
  teams: Team[];
  canCreate: boolean;
  planName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"FAMILY" | "WORKSPACE">("FAMILY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.message ?? data.error ?? "Erreur");
      return;
    }
    setOpen(false);
    setName("");
    router.refresh();
    router.push(`/family/${data.team.id}`);
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {teams.map((team) => (
          <Link key={team.id} href={`/family/${team.id}`} className="tile">
            <div className="tile-icon">
              {team.type === "FAMILY" ? <Users className="size-6" /> : <Briefcase className="size-6" />}
            </div>
            <div className="mt-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">{team.name}</h3>
                <span className="text-xs rounded-full bg-[var(--background-elevated)] border border-[var(--border)] px-2 py-0.5 text-[var(--foreground-muted)]">
                  {team.role}
                </span>
              </div>
              <p className="text-sm text-[var(--foreground-muted)] mt-1">
                {team.memberCount} membre{team.memberCount > 1 ? "s" : ""} · {team.fileCount} fichier
                {team.fileCount > 1 ? "s" : ""}
              </p>
            </div>
          </Link>
        ))}

        <button
          onClick={() => (canCreate ? setOpen(true) : null)}
          disabled={!canCreate}
          title={!canCreate ? `Ton plan ${planName} ne permet pas d'espaces partagés. Passe à Famille ou Pro.` : ""}
          className="tile !cursor-pointer flex items-center justify-center text-center border-dashed disabled:opacity-50"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="tile-icon">
              <Plus className="size-6" />
            </div>
            <p className="font-semibold">Créer un espace</p>
            {!canCreate && (
              <p className="text-xs text-[var(--foreground-muted)]">
                Nécessite le plan Famille
              </p>
            )}
          </div>
        </button>
      </div>

      {teams.length === 0 && canCreate && (
        <div className="text-center text-[var(--foreground-muted)] py-8">
          <FolderOpen className="size-12 mx-auto mb-3 opacity-30" />
          <p>Aucun espace pour l&apos;instant.</p>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[var(--background-elevated)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <h2 className="font-semibold">Créer un espace partagé</h2>
              <button onClick={() => setOpen(false)}>
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType("FAMILY")}
                    className={`rounded-xl p-4 border transition-colors text-start ${
                      type === "FAMILY"
                        ? "border-[var(--accent)] bg-[var(--accent)]/10"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <Users className="size-5 mb-2" />
                    <p className="font-medium text-sm">Famille</p>
                    <p className="text-xs text-[var(--foreground-muted)] mt-1">
                      Pour partager des souvenirs entre proches
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("WORKSPACE")}
                    className={`rounded-xl p-4 border transition-colors text-start ${
                      type === "WORKSPACE"
                        ? "border-[var(--accent)] bg-[var(--accent)]/10"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <Briefcase className="size-5 mb-2" />
                    <p className="font-medium text-sm">Workspace</p>
                    <p className="text-xs text-[var(--foreground-muted)] mt-1">
                      Pour collaborer en équipe
                    </p>
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Nom de l&apos;espace</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={type === "FAMILY" ? "Famille Cohen" : "Mon équipe"}
                  className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                />
              </div>
              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <button type="submit" disabled={busy || !name} className="btn-primary w-full justify-center disabled:opacity-50">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Créer
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
