"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Folder,
  RotateCcw,
  Trash2,
  Check,
  Square,
  CheckSquare,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { FileIcon } from "./file-icon";
import { EmptyState } from "./empty-state";
import { ConfirmDialog } from "./confirm-dialog";
import { formatBytes } from "@/lib/utils";

interface TrashFile {
  id: string;
  name: string;
  size: string;
  mimeType: string;
  deletedAt: string | null;
}

interface TrashFolder {
  id: string;
  name: string;
  deletedAt: string | null;
}

export function TrashView({
  files,
  folders,
}: {
  files: TrashFile[];
  folders: TrashFolder[];
}) {
  const router = useRouter();
  const [selFiles, setSelFiles] = useState<Set<string>>(new Set());
  const [selFolders, setSelFolders] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"restore" | "delete" | "empty" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmHardDel, setConfirmHardDel] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const total = files.length + folders.length;
  const totalSelected = selFiles.size + selFolders.size;
  const allSelected = totalSelected === total && total > 0;

  function toggleFile(id: string) {
    setSelFiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleFolder(id: string) {
    setSelFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (allSelected) {
      setSelFiles(new Set());
      setSelFolders(new Set());
    } else {
      setSelFiles(new Set(files.map((f) => f.id)));
      setSelFolders(new Set(folders.map((f) => f.id)));
    }
  }

  async function doAction(action: "restore" | "delete") {
    if (totalSelected === 0) return;
    if (action === "delete") {
      // Délègue à la modale ConfirmDialog
      setConfirmHardDel(true);
      return;
    }
    await runAction(action);
  }

  async function runAction(action: "restore" | "delete") {
    setBusy(action);
    setErr(null);
    const res = await fetch("/api/trash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        fileIds: Array.from(selFiles),
        folderIds: Array.from(selFolders),
      }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErr(data?.error ?? "Erreur");
      return;
    }
    setSelFiles(new Set());
    setSelFolders(new Set());
    setConfirmHardDel(false);
    router.refresh();
  }

  async function performEmpty() {
    setBusy("empty");
    setErr(null);
    const res = await fetch("/api/trash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "empty" }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErr(data?.error ?? "Erreur");
      return;
    }
    setConfirmEmpty(false);
    router.refresh();
  }

  if (total === 0) {
    return (
      <EmptyState
        icon={Trash2}
        variant="violet"
        title="Corbeille vide"
        description="Les fichiers et dossiers supprimés apparaîtront ici. Tu auras 30 jours pour les restaurer avant suppression définitive."
        cta={{ label: "Retour à mes fichiers", href: "/files" }}
      />
    );
  }

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={toggleAll} className="btn-ghost text-xs">
          {allSelected ? <CheckSquare className="size-3.5 text-[var(--accent)]" /> : <Square className="size-3.5" />}
          {allSelected ? `Tout désélectionner (${total})` : "Tout sélectionner"}
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {totalSelected > 0 && (
            <>
              <button
                onClick={() => doAction("restore")}
                disabled={busy !== null}
                className="btn-ghost text-xs !text-[var(--success)]"
              >
                {busy === "restore" ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                Restaurer ({totalSelected})
              </button>
              <button
                onClick={() => doAction("delete")}
                disabled={busy !== null}
                className="btn-ghost text-xs !text-[var(--danger)]"
              >
                {busy === "delete" ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                Supprimer ({totalSelected})
              </button>
              <button
                onClick={() => { setSelFiles(new Set()); setSelFolders(new Set()); }}
                className="btn-ghost text-xs"
              >
                <X className="size-3.5" />
              </button>
            </>
          )}
          <button
            onClick={() => setConfirmEmpty(true)}
            disabled={busy !== null}
            className="btn-ghost text-xs !text-[var(--danger)] border border-[var(--danger)]/30"
          >
            {busy === "empty" ? <Loader2 className="size-3.5 animate-spin" /> : <AlertTriangle className="size-3.5" />}
            Vider la corbeille
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-2xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 px-4 py-3 text-sm text-[var(--danger)]">
          {err}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--background-elevated)] text-[var(--foreground-muted)] text-xs uppercase">
            <tr>
              <th className="w-8 px-2 py-2"></th>
              <th className="text-start px-4 py-2">Nom</th>
              <th className="text-end px-4 py-2 hidden sm:table-cell">Taille</th>
              <th className="text-end px-4 py-2 hidden md:table-cell">Supprimé</th>
              <th className="w-32 px-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {folders.map((f) => {
              const isSel = selFolders.has(f.id);
              return (
                <tr key={f.id} className={`hover:bg-[var(--background-elevated)] ${isSel ? "bg-[var(--accent)]/5" : ""}`}>
                  <td className="px-2 text-center">
                    <input type="checkbox" checked={isSel} onChange={() => toggleFolder(f.id)} className="accent-[var(--accent)]" />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Folder className="size-5 text-[var(--secondary)] opacity-70" />
                      <span className="truncate">{f.name}</span>
                      <span className="text-[10px] rounded-full bg-[var(--background-elevated)] px-2 py-0.5 text-[var(--foreground-muted)]">
                        dossier
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-end text-xs text-[var(--foreground-muted)] hidden sm:table-cell">—</td>
                  <td className="px-4 py-2 text-end text-xs text-[var(--foreground-muted)] hidden md:table-cell">
                    {f.deletedAt ? new Date(f.deletedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-2 text-center">
                    <button
                      onClick={async () => {
                        setSelFolders(new Set([f.id]));
                        setSelFiles(new Set());
                        setTimeout(() => doAction("restore"), 0);
                      }}
                      className="text-xs text-[var(--success)] hover:underline"
                    >
                      Restaurer
                    </button>
                  </td>
                </tr>
              );
            })}
            {files.map((f) => {
              const isSel = selFiles.has(f.id);
              return (
                <tr key={f.id} className={`hover:bg-[var(--background-elevated)] ${isSel ? "bg-[var(--accent)]/5" : ""}`}>
                  <td className="px-2 text-center">
                    <input type="checkbox" checked={isSel} onChange={() => toggleFile(f.id)} className="accent-[var(--accent)]" />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <FileIcon mimeType={f.mimeType} className="size-5 opacity-70" />
                      <span className="truncate">{f.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-end text-xs text-[var(--foreground-muted)] hidden sm:table-cell">
                    {formatBytes(Number(f.size))}
                  </td>
                  <td className="px-4 py-2 text-end text-xs text-[var(--foreground-muted)] hidden md:table-cell">
                    {f.deletedAt ? new Date(f.deletedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-2 text-center">
                    <button
                      onClick={async () => {
                        setSelFiles(new Set([f.id]));
                        setSelFolders(new Set());
                        setTimeout(() => doAction("restore"), 0);
                      }}
                      className="text-xs text-[var(--success)] hover:underline"
                    >
                      Restaurer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--foreground-muted)] text-center pt-4">
        Astuce : les fichiers en corbeille comptent dans ton quota tant qu&apos;ils ne sont pas
        définitivement supprimés. Vider la corbeille libère de l&apos;espace.
      </p>

      <ConfirmDialog
        open={confirmHardDel}
        title={`Supprimer définitivement ${totalSelected} élément(s) ?`}
        message="Cette action est irréversible. Les fichiers seront effacés du stockage et leur espace sera libéré dans ton quota."
        confirmLabel="Supprimer définitivement"
        destructive
        onClose={() => setConfirmHardDel(false)}
        onConfirm={() => runAction("delete")}
      />

      <ConfirmDialog
        open={confirmEmpty}
        title={`Vider toute la corbeille (${total} élément(s)) ?`}
        message="Tous les fichiers et dossiers en corbeille seront effacés définitivement. Action irréversible."
        confirmLabel="Tout vider"
        destructive
        onClose={() => setConfirmEmpty(false)}
        onConfirm={performEmpty}
      />
    </>
  );
}
