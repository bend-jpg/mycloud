"use client";

import { useState, useMemo, useRef } from "react";
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
  Users,
  Eye,
  FileArchive,
  Loader2,
} from "lucide-react";
import { FileIcon } from "./file-icon";
import { FileThumbnail } from "./file-thumbnail";
import { ShareDialog } from "./share-dialog";
import { FilePreviewModal } from "./file-preview-modal";
import { PortalMenu } from "./portal-menu";
import { PromptDialog } from "./prompt-dialog";
import { useToast } from "./toast";
import { formatBytes } from "@/lib/utils";
import { useLasso } from "@/lib/use-lasso";

export interface FileRow {
  id: string;
  name: string;
  size: string;
  mimeType: string;
  uploadedAt: string;
  sharedToTeams?: { id: string; name: string }[];
}

export interface FolderRow {
  id: string;
  name: string;
  updatedAt: string;
}

export interface TeamLite {
  id: string;
  name: string;
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

function isImageMime(mime: string) {
  return mime.startsWith("image/");
}

// Type du payload drag-drop
interface DragPayload {
  fileIds: string[];
  folderIds: string[];
}

export function FileList({
  folders,
  files,
  folderUrlBase = "/files",
  myTeams = [],
  canShareToTeams = true,
  teamId = null,
}: {
  folders: FolderRow[];
  files: FileRow[];
  folderUrlBase?: string;
  myTeams?: TeamLite[];
  canShareToTeams?: boolean;
  /** Si défini, les drag-drop déplacent dans ce team. Sinon, espace perso. */
  teamId?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [shareFile, setShareFile] = useState<{ id: string; name: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<FileRow | null>(null);
  const [renameFile, setRenameFile] = useState<{ id: string; name: string } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");
  const [view, setView] = useState<ViewMode>("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectFolders, setSelectFolders] = useState<Set<string>>(new Set());
  const [sortOpen, setSortOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  // Lasso : on lui passe un callback qui sélectionne tous les items du rectangle
  const { rect: lassoRect, onMouseDown: onLassoStart } = useLasso(containerRef, (ids, additive) => {
    const newFiles = new Set(additive ? selected : []);
    const newFolders = new Set(additive ? selectFolders : []);
    for (const id of ids) {
      if (id.startsWith("file:")) newFiles.add(id.slice(5));
      else if (id.startsWith("folder:")) newFolders.add(id.slice(7));
    }
    setSelected(newFiles);
    setSelectFolders(newFolders);
  });

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
        default: return a.name.localeCompare(b.name);
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

  function openRenameDialog(id: string, current: string) {
    setRenameFile({ id, name: current });
    setOpenMenu(null);
  }

  async function submitRename(name: string) {
    if (!renameFile) return;
    if (name === renameFile.name) {
      setRenameFile(null);
      return;
    }
    const res = await fetch(`/api/files/${renameFile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      toast.success("Fichier renommé");
      setRenameFile(null);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? "Erreur lors du renommage");
    }
  }

  async function handleShareToTeam(id: string, tId: string) {
    const res = await fetch(`/api/files/${id}/share-to-team`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: tId }),
    });
    if (res.ok) router.refresh();
    else {
      const data = await res.json().catch(() => null);
      toast.error("Impossible de partager : " + (data?.error ?? "erreur"));
    }
    setOpenMenu(null);
  }

  async function handleUnshareFromTeam(id: string, tId: string) {
    if (!confirm("Retirer le fichier de cette famille ?")) return;
    const res = await fetch(`/api/files/${id}/share-to-team?teamId=${tId}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    setOpenMenu(null);
  }

  async function bulkDelete() {
    if (totalSelected === 0) return;
    if (!confirm(`Mettre ${totalSelected} élément(s) dans la corbeille ?`)) return;
    setBulkBusy(true);
    await Promise.all([
      ...Array.from(selected).map((id) => fetch(`/api/files/${id}`, { method: "DELETE" })),
      ...Array.from(selectFolders).map((id) => fetch(`/api/folders/${id}`, { method: "DELETE" })),
    ]);
    setBulkBusy(false);
    clearSelection();
    router.refresh();
  }

  async function bulkDownloadZip() {
    if (selected.size === 0) return;
    setZipBusy(true);
    try {
      const res = await fetch("/api/files/bulk-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: Array.from(selected) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error("Téléchargement zip impossible : " + (data?.message ?? data?.error ?? res.status));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mytitancloud-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setZipBusy(false);
    }
  }

  // ============================================================
  // DRAG-DROP
  // ============================================================
  function onItemDragStart(e: React.DragEvent, kind: "file" | "folder", id: string) {
    // Si l'item draggé fait partie de la sélection, on déplace toute la sélection.
    // Sinon, on ne déplace que cet item.
    let fileIds: string[] = [];
    let folderIds: string[] = [];
    const isInSelection =
      (kind === "file" && selected.has(id)) || (kind === "folder" && selectFolders.has(id));
    if (isInSelection) {
      fileIds = Array.from(selected);
      folderIds = Array.from(selectFolders);
    } else {
      if (kind === "file") fileIds = [id];
      else folderIds = [id];
    }
    const payload: DragPayload = { fileIds, folderIds };
    e.dataTransfer.setData("application/x-mytitancloud", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }

  function onFolderDragOver(e: React.DragEvent, folderId: string) {
    if (!e.dataTransfer.types.includes("application/x-mytitancloud")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverFolder(folderId);
  }

  function onFolderDragLeave() {
    setDragOverFolder(null);
  }

  async function onFolderDrop(e: React.DragEvent, folderId: string) {
    e.preventDefault();
    setDragOverFolder(null);
    const raw = e.dataTransfer.getData("application/x-mytitancloud");
    if (!raw) return;
    try {
      const payload: DragPayload = JSON.parse(raw);
      // Si on essaie de déposer un dossier dans lui-même, ignore
      const folderIds = payload.folderIds.filter((id) => id !== folderId);
      if (payload.fileIds.length === 0 && folderIds.length === 0) return;
      const res = await fetch("/api/files/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileIds: payload.fileIds,
          folderIds,
          targetFolderId: folderId,
          targetTeamId: teamId,
        }),
      });
      if (res.ok) {
        clearSelection();
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        toast.error("Déplacement impossible : " + (data?.error ?? res.status));
      }
    } catch {
      // ignore
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setSortOpen((v) => !v)} className="btn-ghost text-xs">
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
          <button onClick={selectMode ? clearSelection : selectAll} className="btn-ghost text-xs">
            {selectMode ? <CheckSquare className="size-3.5 text-[var(--accent)]" /> : <Square className="size-3.5" />}
            {selectMode ? `${totalSelected} sélectionné(s)` : "Tout sélectionner"}
          </button>
        </div>

        {selectMode && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            {selected.size > 0 && (
              <button
                onClick={bulkDownloadZip}
                disabled={zipBusy}
                className="btn-ghost text-xs"
                title="Télécharger en .zip"
              >
                {zipBusy ? <Loader2 className="size-3.5 animate-spin" /> : <FileArchive className="size-3.5" />}
                Zip ({selected.size})
              </button>
            )}
            <button onClick={bulkDelete} disabled={bulkBusy} className="btn-ghost text-xs !text-[var(--danger)]">
              <Trash2 className="size-3.5" />
              Supprimer ({totalSelected})
            </button>
            <button onClick={clearSelection} className="btn-ghost text-xs">
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Astuce d'utilisation (visible quand rien n'est sélectionné, vue grille) */}
      {!selectMode && view === "grid" && (folders.length > 0 || files.length > 0) && (
        <p className="text-xs text-[var(--foreground-muted)] mb-2">
          Astuce : <strong>cliquer-glisser</strong> dans le vide pour sélectionner plusieurs éléments,{" "}
          <strong>cliquer-glisser un fichier sur un dossier</strong> pour le déplacer.
        </p>
      )}

      {folders.length === 0 && files.length === 0 ? (
        <div className="text-center text-[var(--foreground-muted)] py-16">
          <p className="text-base">Aucun fichier ici.</p>
          <p className="text-sm mt-1">Dépose un fichier dans la zone à droite, ou crée un dossier.</p>
        </div>
      ) : view === "grid" ? (
        <div
          ref={containerRef}
          onMouseDown={onLassoStart}
          className="relative select-none"
        >
          <GridView
            folders={sortedFolders}
            files={sortedFiles}
            folderUrlBase={folderUrlBase}
            myTeams={myTeams}
            canShareToTeams={canShareToTeams}
            selected={selected}
            selectFolders={selectFolders}
            selectMode={selectMode}
            toggleFile={toggleFile}
            toggleFolder={toggleFolder}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            onPreview={(f) => setPreviewFile(f)}
            onShare={(id, name) => { setShareFile({ id, name }); setOpenMenu(null); }}
            onRename={openRenameDialog}
            onDelete={handleDelete}
            onShareToTeam={handleShareToTeam}
            onUnshareFromTeam={handleUnshareFromTeam}
            onItemDragStart={onItemDragStart}
            onFolderDragOver={onFolderDragOver}
            onFolderDragLeave={onFolderDragLeave}
            onFolderDrop={onFolderDrop}
            dragOverFolder={dragOverFolder}
          />
          {/* Rectangle de sélection lasso */}
          {lassoRect && lassoRect.w > 2 && lassoRect.h > 2 && (
            <div
              className="absolute pointer-events-none border-2 border-[var(--accent)] bg-[var(--accent)]/10 rounded-md"
              style={{
                left: lassoRect.x,
                top: lassoRect.y,
                width: lassoRect.w,
                height: lassoRect.h,
              }}
            />
          )}
        </div>
      ) : (
        <ListView
          folders={sortedFolders}
          files={sortedFiles}
          folderUrlBase={folderUrlBase}
          myTeams={myTeams}
          canShareToTeams={canShareToTeams}
          selected={selected}
          selectFolders={selectFolders}
          selectMode={selectMode}
          toggleFile={toggleFile}
          toggleFolder={toggleFolder}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          onPreview={(f) => setPreviewFile(f)}
          onShare={(id, name) => setShareFile({ id, name })}
          onDelete={handleDelete}
          onShareToTeam={handleShareToTeam}
          onUnshareFromTeam={handleUnshareFromTeam}
          onItemDragStart={onItemDragStart}
          onFolderDragOver={onFolderDragOver}
          onFolderDragLeave={onFolderDragLeave}
          onFolderDrop={onFolderDrop}
          dragOverFolder={dragOverFolder}
        />
      )}

      {shareFile && (
        <ShareDialog fileId={shareFile.id} fileName={shareFile.name} onClose={() => setShareFile(null)} />
      )}

      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}

      <PromptDialog
        open={!!renameFile}
        title="Renommer le fichier"
        defaultValue={renameFile?.name ?? ""}
        submitLabel="Renommer"
        placeholder="Nouveau nom"
        validate={(v) => {
          if (v.length > 255) return "Nom trop long (max 255 caractères)";
          if (v.includes("/") || v.includes("\\")) return "Caractères / et \\ interdits";
          return null;
        }}
        onClose={() => setRenameFile(null)}
        onSubmit={submitRename}
      />
    </>
  );
}

// ============================================================
// GRID VIEW
// ============================================================
function GridView({
  folders, files, folderUrlBase, myTeams, canShareToTeams,
  selected, selectFolders, selectMode,
  toggleFile, toggleFolder, openMenu, setOpenMenu,
  onPreview, onShare, onRename, onDelete, onShareToTeam, onUnshareFromTeam,
  onItemDragStart, onFolderDragOver, onFolderDragLeave, onFolderDrop, dragOverFolder,
}: {
  folders: FolderRow[];
  files: FileRow[];
  folderUrlBase: string;
  myTeams: TeamLite[];
  canShareToTeams: boolean;
  selected: Set<string>;
  selectFolders: Set<string>;
  selectMode: boolean;
  toggleFile: (id: string) => void;
  toggleFolder: (id: string) => void;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  onPreview: (f: FileRow) => void;
  onShare: (id: string, name: string) => void;
  onRename: (id: string, current: string) => void;
  onDelete: (id: string) => void;
  onShareToTeam: (id: string, teamId: string) => void;
  onUnshareFromTeam: (id: string, teamId: string) => void;
  onItemDragStart: (e: React.DragEvent, kind: "file" | "folder", id: string) => void;
  onFolderDragOver: (e: React.DragEvent, id: string) => void;
  onFolderDragLeave: () => void;
  onFolderDrop: (e: React.DragEvent, id: string) => void;
  dragOverFolder: string | null;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {folders.map((f) => {
        const isSelected = selectFolders.has(f.id);
        const isDragTarget = dragOverFolder === f.id;
        return (
          <div
            key={f.id}
            className={`lasso-item relative group rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] transition-all ${
              isSelected ? "ring-2 ring-[var(--accent)]" : ""
            } ${
              isDragTarget ? "ring-4 ring-[var(--secondary)] bg-[var(--secondary)]/10 scale-105" : "hover:scale-[1.02]"
            }`}
            data-lasso-id={`folder:${f.id}`}
            draggable
            onDragStart={(e) => onItemDragStart(e, "folder", f.id)}
            onDragOver={(e) => onFolderDragOver(e, f.id)}
            onDragLeave={onFolderDragLeave}
            onDrop={(e) => onFolderDrop(e, f.id)}
          >
            {/* Checkbox toujours visible (en haut à gauche) */}
            <button
              data-stop
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFolder(f.id); }}
              className={`absolute top-2 start-2 z-10 size-6 rounded-md flex items-center justify-center border-2 transition-all ${
                isSelected
                  ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-foreground)]"
                  : "bg-[var(--background-elevated)]/80 border-[var(--border)] hover:border-[var(--accent)] backdrop-blur"
              }`}
              title={isSelected ? "Désélectionner" : "Sélectionner"}
            >
              {isSelected && <Check className="size-3.5" />}
            </button>

            {/* Zone visuelle — clic = ouvrir le dossier (hauteur fixe 7rem) */}
            <Link
              href={`${folderUrlBase}/${f.id}`}
              onClick={(e) => { if (selectMode) { e.preventDefault(); toggleFolder(f.id); } }}
              className="relative block h-28 bg-[var(--background-elevated)] flex items-center justify-center rounded-t-2xl overflow-hidden"
            >
              <Folder className="size-12 text-[var(--secondary)]" />
            </Link>

            {/* Zone info — hauteur fixe pour matcher les fichiers */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleFolder(f.id); }}
              className="w-full text-start px-3 py-2.5 h-14 cursor-pointer hover:bg-[var(--background-elevated)]/40"
            >
              <p className="font-medium truncate text-sm leading-tight">{f.name}</p>
              <p className="text-xs text-[var(--foreground-muted)]">
                {isDragTarget ? "Déposer ici" : "Dossier"}
              </p>
            </button>
          </div>
        );
      })}

      {files.map((f) => {
        const isSelected = selected.has(f.id);
        const sharedTeams = f.sharedToTeams ?? [];
        const availableTeams = myTeams.filter((t) => !sharedTeams.some((s) => s.id === t.id));
        return (
          <div
            key={f.id}
            className={`lasso-item relative group rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] transition-all hover:scale-[1.02] ${
              isSelected ? "ring-2 ring-[var(--accent)]" : ""
            }`}
            data-lasso-id={`file:${f.id}`}
            draggable
            onDragStart={(e) => onItemDragStart(e, "file", f.id)}
          >
            {/* Checkbox toujours visible (en haut à gauche) */}
            <button
              data-stop
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFile(f.id); }}
              className={`absolute top-2 start-2 z-10 size-6 rounded-md flex items-center justify-center border-2 transition-all ${
                isSelected
                  ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-foreground)]"
                  : "bg-[var(--background-elevated)]/80 border-[var(--border)] hover:border-[var(--accent)] backdrop-blur"
              }`}
              title={isSelected ? "Désélectionner" : "Sélectionner"}
            >
              {isSelected && <Check className="size-3.5" />}
            </button>

            {/* Pastille "partagé famille" */}
            {sharedTeams.length > 0 && (
              <div
                className="absolute top-2 z-10 end-10 bg-[var(--accent)]/90 text-[var(--accent-foreground)] rounded-full px-1.5 py-0.5 text-[10px] font-medium flex items-center gap-1 shadow"
                title={`Partagé avec : ${sharedTeams.map((t) => t.name).join(", ")}`}
              >
                <Users className="size-3" />
                <span className="hidden sm:inline">
                  {sharedTeams.length === 1 ? sharedTeams[0].name : sharedTeams.length}
                </span>
              </div>
            )}

            {/* Menu 3-points via Portal — top-right, ne déborde plus de la card */}
            <div className="absolute top-2 end-2 z-10" data-stop>
              <PortalMenu
                width={208}
                trigger={
                  <button
                    type="button"
                    title="Plus d'actions"
                    className="rounded-md p-1 bg-[var(--background-elevated)]/80 hover:bg-[var(--background-elevated)] border border-[var(--border)] backdrop-blur"
                  >
                    <MoreVertical className="size-4" />
                  </button>
                }
              >
                <button onClick={() => onPreview(f)} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-start">
                  <Eye className="size-4" /> Aperçu
                </button>
                <a href={`/api/files/${f.id}/download`} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)]">
                  <Download className="size-4" /> Télécharger
                </a>
                <button onClick={() => onShare(f.id, f.name)} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-start">
                  <LinkIcon className="size-4" /> Partager par lien
                </button>
                <button onClick={() => onRename(f.id, f.name)} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-start">
                  <Pencil className="size-4" /> Renommer
                </button>
                {canShareToTeams && availableTeams.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] uppercase text-[var(--foreground-muted)] mt-1">Donner accès à</div>
                    {availableTeams.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onShareToTeam(f.id, t.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-start"
                      >
                        <Users className="size-4" /> {t.name}
                      </button>
                    ))}
                  </>
                )}
                {sharedTeams.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] uppercase text-[var(--foreground-muted)] mt-1">Retirer de</div>
                    {sharedTeams.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onUnshareFromTeam(f.id, t.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-start text-[var(--foreground-muted)]"
                      >
                        <X className="size-4" /> {t.name}
                      </button>
                    ))}
                  </>
                )}
                <div className="border-t border-[var(--border)] my-1" />
                <button onClick={() => onDelete(f.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-[var(--danger)] text-start">
                  <Trash2 className="size-4" /> Supprimer
                </button>
              </PortalMenu>
            </div>

            {/* Zone visuelle (vignette) — clic = preview (hauteur fixe 7rem comme dossier) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (selectMode) { toggleFile(f.id); return; }
                onPreview(f);
              }}
              className="relative block w-full h-28 bg-[var(--background-elevated)] overflow-hidden cursor-pointer rounded-t-2xl"
              title="Cliquer pour voir l'aperçu — utilise la case en haut à gauche pour sélectionner"
            >
              <FileThumbnail
                fileId={f.id}
                mimeType={f.mimeType}
                alt={f.name}
                className="w-full h-full"
                iconClassName="size-12"
              />
            </button>

            {/* Zone info — hauteur fixe identique au dossier */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleFile(f.id); }}
              className="w-full text-start px-3 py-2.5 h-14 cursor-pointer hover:bg-[var(--background-elevated)]/40"
              title="Cliquer pour sélectionner"
            >
              <p className="font-medium truncate text-sm leading-tight" title={f.name}>{f.name}</p>
              <p className="text-xs text-[var(--foreground-muted)]">{formatBytes(Number(f.size))}</p>
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// LIST VIEW (drag-drop simple, pas de lasso)
// ============================================================
function ListView({
  folders, files, folderUrlBase, myTeams, canShareToTeams,
  selected, selectFolders, selectMode,
  toggleFile, toggleFolder, openMenu, setOpenMenu,
  onPreview, onShare, onDelete, onShareToTeam, onUnshareFromTeam,
  onItemDragStart, onFolderDragOver, onFolderDragLeave, onFolderDrop, dragOverFolder,
}: {
  folders: FolderRow[];
  files: FileRow[];
  folderUrlBase: string;
  myTeams: TeamLite[];
  canShareToTeams: boolean;
  selected: Set<string>;
  selectFolders: Set<string>;
  selectMode: boolean;
  toggleFile: (id: string) => void;
  toggleFolder: (id: string) => void;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  onPreview: (f: FileRow) => void;
  onShare: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onShareToTeam: (id: string, teamId: string) => void;
  onUnshareFromTeam: (id: string, teamId: string) => void;
  onItemDragStart: (e: React.DragEvent, kind: "file" | "folder", id: string) => void;
  onFolderDragOver: (e: React.DragEvent, id: string) => void;
  onFolderDragLeave: () => void;
  onFolderDrop: (e: React.DragEvent, id: string) => void;
  dragOverFolder: string | null;
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
            const isDragTarget = dragOverFolder === f.id;
            return (
              <tr
                key={f.id}
                draggable
                onDragStart={(e) => onItemDragStart(e, "folder", f.id)}
                onDragOver={(e) => onFolderDragOver(e, f.id)}
                onDragLeave={onFolderDragLeave}
                onDrop={(e) => onFolderDrop(e, f.id)}
                className={`hover:bg-[var(--background-elevated)] ${isSelected ? "bg-[var(--accent)]/5" : ""} ${
                  isDragTarget ? "bg-[var(--secondary)]/15 outline outline-2 outline-[var(--secondary)]" : ""
                }`}
              >
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
            const isImage = isImageMime(f.mimeType);
            const sharedTeams = f.sharedToTeams ?? [];
            const availableTeams = myTeams.filter((t) => !sharedTeams.some((s) => s.id === t.id));
            return (
              <tr
                key={f.id}
                draggable
                onDragStart={(e) => onItemDragStart(e, "file", f.id)}
                className={`hover:bg-[var(--background-elevated)] ${isSelected ? "bg-[var(--accent)]/5" : ""}`}
              >
                <td className="px-2 text-center">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleFile(f.id)} className="accent-[var(--accent)]" />
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => onPreview(f)}
                    className="flex items-center gap-2 hover:text-[var(--accent)] text-start w-full"
                  >
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/files/${f.id}/preview`}
                        alt=""
                        loading="lazy"
                        draggable={false}
                        className="size-8 rounded object-cover bg-[var(--background-elevated)]"
                      />
                    ) : (
                      <FileIcon mimeType={f.mimeType} className="size-5" />
                    )}
                    <span className="truncate">{f.name}</span>
                    {sharedTeams.length > 0 && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] text-[10px]"
                        title={`Partagé avec : ${sharedTeams.map((t) => t.name).join(", ")}`}
                      >
                        <Users className="size-3" />
                        {sharedTeams.length === 1 ? sharedTeams[0].name : sharedTeams.length}
                      </span>
                    )}
                  </button>
                </td>
                <td className="px-4 py-2 text-end text-xs text-[var(--foreground-muted)] hidden sm:table-cell">{formatBytes(Number(f.size))}</td>
                <td className="px-4 py-2 text-end text-xs text-[var(--foreground-muted)] hidden md:table-cell">
                  {new Date(f.uploadedAt).toLocaleDateString()}
                </td>
                <td className="px-2 text-center relative">
                  <div className="flex justify-end gap-1">
                    <a href={`/api/files/${f.id}/download`} className="p-1.5 rounded-lg hover:bg-[var(--background-tile)]" title="Télécharger">
                      <Download className="size-4" />
                    </a>
                    <button onClick={() => onShare(f.id, f.name)} className="p-1.5 rounded-lg hover:bg-[var(--background-tile)]" title="Partager par lien">
                      <LinkIcon className="size-4" />
                    </button>
                    <button
                      onClick={() => setOpenMenu(openMenu === f.id ? null : f.id)}
                      className="p-1.5 rounded-lg hover:bg-[var(--background-tile)]"
                      title="Plus"
                    >
                      <MoreVertical className="size-4" />
                    </button>
                    <button onClick={() => onDelete(f.id)} className="p-1.5 rounded-lg hover:bg-[var(--background-tile)] text-[var(--danger)]" title="Supprimer">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {openMenu === f.id && (
                    <div className="absolute end-2 top-10 w-52 rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] shadow-2xl z-30 p-1 text-start max-h-80 overflow-y-auto">
                      {canShareToTeams && availableTeams.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 text-[10px] uppercase text-[var(--foreground-muted)]">Donner accès à</div>
                          {availableTeams.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => { onShareToTeam(f.id, t.id); setOpenMenu(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)]"
                            >
                              <Users className="size-4" /> {t.name}
                            </button>
                          ))}
                        </>
                      )}
                      {sharedTeams.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 text-[10px] uppercase text-[var(--foreground-muted)] mt-1">Retirer de</div>
                          {sharedTeams.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => { onUnshareFromTeam(f.id, t.id); setOpenMenu(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-[var(--foreground-muted)]"
                            >
                              <X className="size-4" /> {t.name}
                            </button>
                          ))}
                        </>
                      )}
                      {(availableTeams.length === 0 && sharedTeams.length === 0) && (
                        <p className="px-3 py-2 text-xs text-[var(--foreground-muted)]">Aucune famille disponible.</p>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
