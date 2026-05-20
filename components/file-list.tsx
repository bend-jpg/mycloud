"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  Folder,
  MoreVertical,
  Download,
  Pencil,
  Trash2,
  Link as LinkIcon,
  Check,
  X,
  CheckSquare,
  Square,
  LayoutGrid,
  List,
  ArrowUpDown,
  ChevronDown,
} from "lucide-react";
import { FileIcon } from "./file-icon";
import { ShareDialog } from "./share-dialog";
import { formatBytes } from "@/lib/utils";

export interface FileRow {
  id: string;
  name: string;
  size: string;
  mimeType: string;
  uploadedAt: string;
}

export interface FolderRow {
  id: string;
  name: string;
  updatedAt: string;
}

type SortKey = "name-asc" | "name-desc" | "date-desc" | "date-asc" | "size-desc" | "size-asc";
type ViewMode = "grid" | "list";

const SORT_LABEL: Record<SortKey, string> = {
  "name-asc": "Nom A→Z",
  "name-desc": "Nom Z→A",
  "date-desc": "Plus récent",
  "date-asc": "Plus ancien",
  "size-desc": "Plus volumineux",
  "size-asc": "Plus petit",
};

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
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");
  const [view, setView] = useState<ViewMode>("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectFolders, setSelectFolders] = useState<Set<string>>(new Set());
  const [sortOpen, setSortOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const sortedFiles = useMemo(() => {
    const arr = [...files];
    arr.sort((a, b) => {
      switch (sortKey) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "size-desc": return Number(b.size) - Number(a.size);
        case "size-asc": return Number(a.size) - Number(b.size);
        case "date-asc": return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
        case "date-desc":
        default: return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      }
    });
    return arr;
  }, [files, sortKey]);

  const sortedFolders = useMemo(() => {
    const arr = [...folders];
    arr.sort((a, b) => {
      switch (sortKey) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        default: return a.name.localeCompare(b.name); // les dossiers : toujours par nom
      }
    });
    return arr;
  }, [folders, sortKey]);

  const totalSelected = selected.size + selectFolders.size;
  const selectMode = totalSelected > 0;

  function toggleFile(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleFolder(id: string) {
    setSelectFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAll() {
    setSelected(new Set(files.map((f) => f.id)));
    setSelectFolders(new Set(folders.map((f) => f.id)));
  }
  function clearSelection() {
    setSelected(new Set());
    setSelectFolders(new Set());
  }

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

  async function bulkDelete() {
    if (totalSelected === 0) return;
    if (!confirm(`Mettre ${totalSelected} élément(s) dans la corbeille ?`)) return;
    setBulkBusy(true);
    await Promise.all([
      ...Array.from(selected).map((id) => fetch(`/api/files/${id}`, { method: "DELETE" })),
      // Les dossiers : pas encore d'endpoint dédié, on saute pour l'instant
    ]);
    setBulkBusy(false);
    clearSelection();
    router.refresh();
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2">
          {/* Tri */}
          <div className="relative">
            <button
              onClick={() => setSortOpen((v) => !v)}
              className="btn-ghost text-xs"
            >
              <ArrowUpDown className="size-3.5" />
              {SORT_LABEL[sortKey]}
              <ChevronDown className="size-3" />
            </button>
            {sortOpen && (
              <div className="absolute start-0 mt-1 w-44 rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] p-1 shadow-2xl z-30">
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => { setSortKey(k); setSortOpen(false); }}
                    className={`w-full text-start text-xs rounded-lg px-3 py-2 ${sortKey === k ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "hover:bg-[var(--background-tile)]"}`}
                  >
                    {SORT_LABEL[k]}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Vue grid/list */}
          <div className="inline-flex rounded-full border border-[var(--border)] p-0.5 bg-[var(--background-tile)]">
            <button
              onClick={() => setView("grid")}
              className={`p-1.5 rounded-full ${view === "grid" ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "text-[var(--foreground-muted)]"}`}
              title="Vue grille"
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-1.5 rounded-full ${view === "list" ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "text-[var(--foreground-muted)]"}`}
              title="Vue liste"
            >
              <List className="size-3.5" />
            </button>
          </div>
          {/* Sélection */}
          <button
            onClick={selectMode ? clearSelection : selectAll}
            className="btn-ghost text-xs"
          >
            {selectMode ? <CheckSquare className="size-3.5 text-[var(--accent)]" /> : <Square className="size-3.5" />}
            {selectMode ? `${totalSelected} sélectionné(s)` : "Tout sélectionner"}
          </button>
        </div>

        {/* Bulk actions (visible si sélection) */}
        {selectMode && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <button onClick={bulkDelete} disabled={bulkBusy} className="btn-ghost text-xs !text-[var(--danger)]">
              <Trash2 className="size-3.5" />
              Supprimer ({selected.size})
            </button>
            <button onClick={clearSelection} className="btn-ghost text-xs">
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {folders.length === 0 && files.length === 0 ? (
        <div className="text-center text-[var(--foreground-muted)] py-16">
          <p className="text-base">Aucun fichier ici.</p>
          <p className="text-sm mt-1">Dépose un fichier dans la zone à droite, ou crée un dossier.</p>
        </div>
      ) : view === "grid" ? (
        <GridView
          folders={sortedFolders}
          files={sortedFiles}
          folderUrlBase={folderUrlBase}
          selected={selected}
          selectFolders={selectFolders}
          selectMode={selectMode}
          toggleFile={toggleFile}
          toggleFolder={toggleFolder}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          onShare={(id, name) => { setShareFile({ id, name }); setOpenMenu(null); }}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      ) : (
        <ListView
          folders={sortedFolders}
          files={sortedFiles}
          folderUrlBase={folderUrlBase}
          selected={selected}
          selectFolders={selectFolders}
          selectMode={selectMode}
          toggleFile={toggleFile}
          toggleFolder={toggleFolder}
          onShare={(id, name) => setShareFile({ id, name })}
          onDelete={handleDelete}
        />
      )}

      {shareFile && (
        <ShareDialog
          fileId={shareFile.id}
          fileName={shareFile.name}
          onClose={() => setShareFile(null)}
        />
      )}
    </>
  );
}

// ============================================================
// GRID VIEW
// ============================================================
function GridView({
  folders, files, folderUrlBase, selected, selectFolders, selectMode,
  toggleFile, toggleFolder, openMenu, setOpenMenu, onShare, onRename, onDelete,
}: {
  folders: FolderRow[];
  files: FileRow[];
  folderUrlBase: string;
  selected: Set<string>;
  selectFolders: Set<string>;
  selectMode: boolean;
  toggleFile: (id: string) => void;
  toggleFolder: (id: string) => void;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  onShare: (id: string, name: string) => void;
  onRename: (id: string, current: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {folders.map((f) => {
        const isSelected = selectFolders.has(f.id);
        return (
          <div key={f.id} className="relative group">
            {(selectMode || isSelected) && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFolder(f.id); }}
                className={`absolute top-2 start-2 z-10 size-6 rounded-md flex items-center justify-center transition-all ${
                  isSelected
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)] opacity-100"
                    : "bg-[var(--background-elevated)] border border-[var(--border)] opacity-0 group-hover:opacity-100"
                }`}
              >
                {isSelected && <Check className="size-3.5" />}
              </button>
            )}
            <Link
              href={`${folderUrlBase}/${f.id}`}
              onClick={(e) => { if (selectMode) { e.preventDefault(); toggleFolder(f.id); } }}
              className={`tile cursor-pointer hover:scale-[1.02] !min-h-32 !p-4 ${isSelected ? "ring-2 ring-[var(--accent)]" : ""}`}
            >
              <Folder className="size-10 text-[var(--secondary)]" />
              <div className="mt-auto">
                <p className="font-medium truncate text-sm">{f.name}</p>
                <p className="text-xs text-[var(--foreground-muted)]">Dossier</p>
              </div>
            </Link>
          </div>
        );
      })}

      {files.map((f) => {
        const isSelected = selected.has(f.id);
        return (
          <div key={f.id} className={`tile cursor-default !min-h-32 !p-4 relative group ${isSelected ? "ring-2 ring-[var(--accent)]" : ""}`}>
            {(selectMode || isSelected) && (
              <button
                onClick={() => toggleFile(f.id)}
                className={`absolute top-2 start-2 z-10 size-6 rounded-md flex items-center justify-center transition-all ${
                  isSelected
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)] opacity-100"
                    : "bg-[var(--background-elevated)] border border-[var(--border)] opacity-0 group-hover:opacity-100"
                }`}
              >
                {isSelected && <Check className="size-3.5" />}
              </button>
            )}
            <FileIcon mimeType={f.mimeType} className="size-10" />
            <div className="mt-auto">
              <p className="font-medium truncate text-sm" title={f.name}>{f.name}</p>
              <p className="text-xs text-[var(--foreground-muted)]">{formatBytes(Number(f.size))}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === f.id ? null : f.id); }}
              className="absolute top-2 end-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-1 hover:bg-[var(--background-elevated)]"
            >
              <MoreVertical className="size-4" />
            </button>
            {openMenu === f.id && (
              <div className="absolute top-10 end-2 w-44 rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] shadow-2xl z-30 p-1">
                <a href={`/api/files/${f.id}/download`} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)]">
                  <Download className="size-4" /> Télécharger
                </a>
                <button onClick={() => onShare(f.id, f.name)} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-start">
                  <LinkIcon className="size-4" /> Partager par lien
                </button>
                <button onClick={() => onRename(f.id, f.name)} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-start">
                  <Pencil className="size-4" /> Renommer
                </button>
                <button onClick={() => onDelete(f.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-[var(--danger)] text-start">
                  <Trash2 className="size-4" /> Supprimer
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// LIST VIEW
// ============================================================
function ListView({
  folders, files, folderUrlBase, selected, selectFolders, selectMode,
  toggleFile, toggleFolder, onShare, onDelete,
}: {
  folders: FolderRow[];
  files: FileRow[];
  folderUrlBase: string;
  selected: Set<string>;
  selectFolders: Set<string>;
  selectMode: boolean;
  toggleFile: (id: string) => void;
  toggleFolder: (id: string) => void;
  onShare: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[var(--background-elevated)] text-[var(--foreground-muted)] text-xs uppercase">
          <tr>
            <th className="w-8 px-2 py-2"></th>
            <th className="text-start px-4 py-2">Nom</th>
            <th className="text-end px-4 py-2 hidden sm:table-cell">Taille</th>
            <th className="text-end px-4 py-2 hidden md:table-cell">Date</th>
            <th className="w-12 px-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {folders.map((f) => {
            const isSelected = selectFolders.has(f.id);
            return (
              <tr key={f.id} className={`hover:bg-[var(--background-elevated)] ${isSelected ? "bg-[var(--accent)]/5" : ""}`}>
                <td className="px-2 text-center">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleFolder(f.id)} className="accent-[var(--accent)]" />
                </td>
                <td className="px-4 py-2">
                  <Link href={`${folderUrlBase}/${f.id}`} onClick={(e) => { if (selectMode) { e.preventDefault(); toggleFolder(f.id); } }} className="flex items-center gap-2 hover:text-[var(--accent)]">
                    <Folder className="size-5 text-[var(--secondary)]" />
                    <span className="truncate">{f.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-2 text-end text-xs text-[var(--foreground-muted)] hidden sm:table-cell">—</td>
                <td className="px-4 py-2 text-end text-xs text-[var(--foreground-muted)] hidden md:table-cell">
                  {new Date(f.updatedAt).toLocaleDateString()}
                </td>
                <td></td>
              </tr>
            );
          })}
          {files.map((f) => {
            const isSelected = selected.has(f.id);
            return (
              <tr key={f.id} className={`hover:bg-[var(--background-elevated)] ${isSelected ? "bg-[var(--accent)]/5" : ""}`}>
                <td className="px-2 text-center">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleFile(f.id)} className="accent-[var(--accent)]" />
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <FileIcon mimeType={f.mimeType} className="size-5" />
                    <span className="truncate">{f.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-end text-xs text-[var(--foreground-muted)] hidden sm:table-cell">{formatBytes(Number(f.size))}</td>
                <td className="px-4 py-2 text-end text-xs text-[var(--foreground-muted)] hidden md:table-cell">
                  {new Date(f.uploadedAt).toLocaleDateString()}
                </td>
                <td className="px-2 text-center">
                  <div className="flex justify-end gap-1">
                    <a href={`/api/files/${f.id}/download`} className="p-1.5 rounded-lg hover:bg-[var(--background-tile)]" title="Télécharger">
                      <Download className="size-4" />
                    </a>
                    <button onClick={() => onShare(f.id, f.name)} className="p-1.5 rounded-lg hover:bg-[var(--background-tile)]" title="Partager">
                      <LinkIcon className="size-4" />
                    </button>
                    <button onClick={() => onDelete(f.id)} className="p-1.5 rounded-lg hover:bg-[var(--background-tile)] text-[var(--danger)]" title="Supprimer">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
