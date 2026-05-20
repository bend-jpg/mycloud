"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Folder, MoreVertical, Download, Pencil, Trash2, Link as LinkIcon } from "lucide-react";
import { FileIcon } from "./file-icon";
import { ShareDialog } from "./share-dialog";
import { formatBytes } from "@/lib/utils";

export interface FileRow {
  id: string;
  name: string;
  size: string; // BigInt sérialisé en string
  mimeType: string;
  uploadedAt: string;
}

export interface FolderRow {
  id: string;
  name: string;
  updatedAt: string;
}

export function FileList({
  folders,
  files,
  folderUrlBase = "/files",
}: {
  folders: FolderRow[];
  files: FileRow[];
  folderUrlBase?: string;
}) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [shareFile, setShareFile] = useState<{ id: string; name: string } | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Mettre dans la corbeille ?")) return;
    const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    setOpenMenu(null);
  }

  async function handleRename(id: string, current: string) {
    const name = prompt("Nouveau nom", current);
    if (!name || name === current) return;
    const res = await fetch(`/api/files/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) router.refresh();
    setOpenMenu(null);
  }

  if (folders.length === 0 && files.length === 0) {
    return (
      <div className="text-center text-[var(--foreground-muted)] py-16">
        <p>Aucun fichier ici. Dépose un fichier pour commencer.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {folders.map((f) => (
        <Link
          key={f.id}
          href={`${folderUrlBase}/${f.id}`}
          className="tile cursor-pointer hover:scale-[1.02] !min-h-32 !p-4 group"
        >
          <Folder className="size-10 text-[var(--secondary)]" />
          <div className="mt-auto">
            <p className="font-medium truncate text-sm">{f.name}</p>
            <p className="text-xs text-[var(--foreground-muted)]">Dossier</p>
          </div>
        </Link>
      ))}

      {files.map((f) => (
        <div key={f.id} className="tile cursor-default !min-h-32 !p-4 relative group">
          <FileIcon mimeType={f.mimeType} className="size-10" />
          <div className="mt-auto">
            <p className="font-medium truncate text-sm" title={f.name}>{f.name}</p>
            <p className="text-xs text-[var(--foreground-muted)]">
              {formatBytes(Number(f.size))}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === f.id ? null : f.id);
            }}
            className="absolute top-2 end-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-1 hover:bg-[var(--background-elevated)]"
          >
            <MoreVertical className="size-4" />
          </button>
          {openMenu === f.id && (
            <div className="absolute top-10 end-2 w-44 rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] shadow-2xl z-30 p-1">
              <a
                href={`/api/files/${f.id}/download`}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)]"
              >
                <Download className="size-4" />
                Télécharger
              </a>
              <button
                onClick={() => {
                  setShareFile({ id: f.id, name: f.name });
                  setOpenMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-start"
              >
                <LinkIcon className="size-4" />
                Partager par lien
              </button>
              <button
                onClick={() => handleRename(f.id, f.name)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-start"
              >
                <Pencil className="size-4" />
                Renommer
              </button>
              <button
                onClick={() => handleDelete(f.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-[var(--danger)] text-start"
              >
                <Trash2 className="size-4" />
                Supprimer
              </button>
            </div>
          )}
        </div>
      ))}

      {shareFile && (
        <ShareDialog
          fileId={shareFile.id}
          fileName={shareFile.name}
          onClose={() => setShareFile(null)}
        />
      )}
    </div>
  );
}
