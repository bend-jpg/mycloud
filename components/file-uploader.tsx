"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Upload, X, CheckCircle2, AlertCircle, FileUp, FolderUp, CloudUpload, Plus, Loader2 } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { makeThumbnail } from "@/lib/make-thumbnail";
import { useToast } from "./toast";

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "completing" | "done" | "error";
  error?: string;
  /** Dossier de destination résolu (upload de dossier). null = dossier courant. */
  targetFolderId?: string | null;
  /** Chemin affiché dans la liste, ex "Vacances/2026/img.jpg". */
  relativePath?: string;
}

/** Fichier accompagné de son chemin relatif quand il vient d'un dossier. */
interface PendingFile {
  file: File;
  relativePath: string; // "" si à la racine de la sélection
}

/**
 * Nombre d'envois simultanés.
 *
 * La version précédente les lançait TOUS en même temps. Sur l'import d'un
 * dossier de site web (une centaine de fichiers), ça ouvrait une centaine de
 * requêtes d'un coup : le serveur ne suivait pas, la plupart échouaient, et
 * comme les dossiers avaient bien été créés il restait une arborescence
 * complète et vide. Constaté en production : 42 dossiers sur 43 sans aucun
 * fichier.
 *
 * Trois à la fois : assez pour saturer une connexion domestique, assez peu
 * pour ne jamais écrouler le serveur.
 */
const MAX_PARALLEL = 3;

/** Tentatives supplémentaires en cas d'erreur passagère (réseau, serveur). */
const MAX_RETRIES = 2;

interface BatchState {
  running: boolean;
  total: number;
  done: number;
  failed: number;
}

/** Durée lisible : « 45 s », « 2 min 10 s ». */
function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.ceil(seconds)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m} min ${s} s` : `${m} min`;
}

/**
 * Parcourt récursivement les entrées d'un drag & drop pour en extraire tous
 * les fichiers, y compris ceux imbriqués dans des dossiers.
 *
 * DEUX PIÈGES, tous les deux sources de contenu manquant en silence :
 *
 *  1. `readEntries` ne renvoie que 100 entrées par appel. Il faut rappeler
 *     le lecteur jusqu'à recevoir un lot vide, sinon un dossier de 300
 *     fichiers n'en livre que 100.
 *
 *  2. Il ne faut PAS descendre dans un sous-dossier au milieu de la lecture
 *     du dossier parent. Le lecteur est un itérateur à état : recréer un
 *     lecteur enfant pendant qu'on l'utilise fait retourner un lot vide
 *     prématurément au parent, et le reste de son contenu disparaît sans
 *     aucune erreur. On vide donc ENTIÈREMENT le dossier courant, puis
 *     seulement ensuite on descend dans ses sous-dossiers.
 */
async function traverseEntry(
  entry: FileSystemEntry,
  prefix: string,
  out: PendingFile[],
): Promise<void> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject));
    out.push({ file, relativePath: prefix });
    return;
  }
  if (!entry.isDirectory) return;

  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;

  // Étape 1 — vider complètement ce dossier, sans rien faire d'autre.
  const children: FileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) break;
    children.push(...batch);
  }

  // Étape 2 — seulement maintenant, descendre dans chaque enfant.
  for (const child of children) await traverseEntry(child, nextPrefix, out);
}

/** Extrait les fichiers d'un DataTransfer en préservant l'arborescence. */
async function filesFromDataTransfer(dt: DataTransfer): Promise<PendingFile[]> {
  const entries: FileSystemEntry[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  // Navigateur sans l'API entries : on retombe sur les fichiers à plat
  if (entries.length === 0) {
    return Array.from(dt.files ?? []).map((file) => ({ file, relativePath: "" }));
  }
  const out: PendingFile[] = [];
  for (const entry of entries) await traverseEntry(entry, "", out);
  return out;
}

export function FileUploader({
  folderId,
  teamId,
}: {
  folderId?: string | null;
  teamId?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [batchState, setBatchState] = useState<BatchState>({
    running: false,
    total: 0,
    done: 0,
    failed: 0,
  });
  // Compteurs d'octets tenus dans des refs : ils changent des dizaines de fois
  // par seconde pendant un envoi, en faire un état rerendrait tout le
  // composant à chaque paquet reçu. `tick` provoque un rafraîchissement
  // régulier de l'affichage, deux fois par seconde, ce qui suffit à l'œil.
  const bytesDoneRef = useRef(0);
  const totalBytesRef = useRef(0);
  const startedAtRef = useRef(0);
  const [, setTick] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  /** Overlay plein-écran quand un drag arrive depuis l'extérieur (bureau, autre onglet). */
  const [pageDragOver, setPageDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /**
   * Envoie UN fichier. Renvoie true en cas de succès.
   *
   * Les erreurs réseau passagères sont réessayées : sur un import de
   * plusieurs dizaines de fichiers, il suffit qu'une requête tombe pour que
   * le fichier manque définitivement, sans que l'utilisateur le remarque au
   * milieu de la liste.
   */
  const uploadOne = useCallback(
    async (item: UploadItem, attempt = 0): Promise<boolean> => {
      const update = (patch: Partial<UploadItem>) =>
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));

      try {
        update({ status: "uploading" });
        // 1. Demander l'URL d'upload
        const initRes = await fetch("/api/files/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.file.name,
            size: item.file.size,
            mimeType: item.file.type || "application/octet-stream",
            // Upload de dossier : le fichier va dans le sous-dossier recréé,
            // pas dans le dossier courant.
            folderId: item.targetFolderId !== undefined ? item.targetFolderId : folderId ?? null,
            teamId: teamId ?? null,
          }),
        });
        if (!initRes.ok) {
          const err = await initRes.json().catch(() => ({ error: "Erreur" }));
          // Messages explicites pour les erreurs courantes
          if (err.error === "FILE_TOO_LARGE") {
            throw new Error(err.message ?? "Fichier trop volumineux pour ton plan");
          }
          if (err.error === "QUOTA_EXCEEDED") {
            throw new Error("Quota de stockage dépassé. Libère de l'espace ou upgrade ton plan.");
          }
          throw new Error(err.message ?? err.error ?? "Erreur d'initialisation");
        }
        const { fileId, uploadUrl, method, headers } = await initRes.json();

        // 2. Upload des bytes avec progression
        let lastLoaded = 0;
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open(method, uploadUrl);
          for (const [k, v] of Object.entries(headers ?? {})) xhr.setRequestHeader(k, v as string);
          xhr.upload.onprogress = (e) => {
            if (!e.lengthComputable) return;
            // Compteur GLOBAL d'octets envoyés : sert à calculer la vitesse et
            // le temps restant sur l'ensemble de l'import, pas fichier par
            // fichier.
            bytesDoneRef.current += e.loaded - lastLoaded;
            lastLoaded = e.loaded;
            update({ progress: Math.round((e.loaded / e.total) * 100) });
          };
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`PUT ${xhr.status}`)));
          xhr.onerror = () => reject(new Error("Erreur réseau"));
          xhr.ontimeout = () => reject(new Error("Délai dépassé"));
          xhr.send(item.file);
        });

        // 3. Finaliser
        update({ status: "completing", progress: 100 });
        const completeRes = await fetch(`/api/files/${fileId}/complete`, { method: "POST" });
        if (!completeRes.ok) throw new Error("Échec de la finalisation");

        // 4. Vignette (images uniquement) — générée par le navigateur pour
        //    que les grilles n'affichent pas des photos de 2 Mo dans des
        //    cases de 200 px. Best-effort : un échec ne compromet pas
        //    l'upload, on retombe simplement sur l'image d'origine.
        try {
          const thumb = await makeThumbnail(item.file);
          if (thumb) {
            await fetch(`/api/files/${fileId}/thumbnail`, {
              method: "PUT",
              headers: { "Content-Type": "image/jpeg" },
              body: thumb,
            });
          }
        } catch {
          // vignette optionnelle
        }

        update({ status: "done", progress: 100 });
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Erreur";
        // Le quota et la taille maximale sont des refus définitifs : les
        // réessayer ne ferait que perdre du temps et masquer la vraie cause.
        const definitif = /[Qq]uota|volumineux|plan/.test(message);

        if (!definitif && attempt < MAX_RETRIES) {
          // Les octets déjà comptés pour cette tentative sont retirés du
          // compteur global, sinon la progression dépasserait 100 %.
          bytesDoneRef.current = Math.max(0, bytesDoneRef.current - item.file.size * (item.progress / 100));
          update({ status: "queued", progress: 0, error: undefined });
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          return uploadOne(item, attempt + 1);
        }

        update({ status: "error", error: message });
        return false;
      }
    },
    [folderId, teamId]
  );

  /**
   * Traite une série de fichiers en limitant le nombre d'envois simultanés.
   *
   * C'EST LA CORRECTION DU BUG PRINCIPAL. La version précédente lançait
   * `newItems.forEach(startUpload)` : sur l'import d'un dossier de site web,
   * ça ouvrait une centaine de requêtes en même temps. Le serveur et la base
   * ne suivaient pas, la plupart des envois échouaient — et comme les
   * dossiers, eux, avaient bien été créés, il restait une arborescence
   * complète et vide. Constaté en production : 42 dossiers sur 43 sans aucun
   * fichier.
   *
   * Trois fichiers à la fois : assez pour saturer une connexion domestique,
   * assez peu pour ne jamais écrouler le serveur.
   */
  const runQueue = useCallback(
    async (queue: UploadItem[]) => {
      if (queue.length === 0) return;

      startedAtRef.current = Date.now();
      bytesDoneRef.current = 0;
      totalBytesRef.current = queue.reduce((s, i) => s + i.file.size, 0);
      setBatchState({ running: true, total: queue.length, done: 0, failed: 0 });

      const ticker = setInterval(() => setTick((t) => t + 1), 500);

      let cursor = 0;
      let done = 0;
      let failed = 0;

      const worker = async () => {
        while (cursor < queue.length) {
          const item = queue[cursor++];
          const ok = await uploadOne(item);
          if (ok) done++;
          else failed++;
          setBatchState({ running: true, total: queue.length, done, failed });
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(MAX_PARALLEL, queue.length) }, worker),
      );

      clearInterval(ticker);
      setBatchState({ running: false, total: queue.length, done, failed });

      // Un SEUL rafraîchissement, à la fin. L'ancienne version en déclenchait
      // un par fichier — inutile, et coûteux sur un import massif.
      router.refresh();

      if (failed === 0) {
        toast.success(
          queue.length === 1
            ? `« ${queue[0].file.name} » importé`
            : `${done} fichier(s) importés`,
        );
        // Tout s'est bien passé : la liste se referme d'elle-même.
        setTimeout(() => setItems((prev) => prev.filter((i) => i.status !== "done")), 2500);
      } else {
        // En cas d'échec on ne referme RIEN : l'utilisateur doit voir quels
        // fichiers manquent, sinon il repart en croyant l'import complet.
        toast.error(`${failed} fichier(s) non importés sur ${queue.length}`);
      }
    },
    [uploadOne, router, toast],
  );

  const handleFiles = useCallback(
    async (input: FileList | File[] | PendingFile[]) => {
      // Normalise : sélection de fichiers simples, sélection de dossier
      // (webkitRelativePath) ou drag & drop d'arborescence (PendingFile).
      const pending: PendingFile[] = Array.from(input as ArrayLike<unknown>).map((entry) => {
        if (entry && typeof entry === "object" && "file" in entry) return entry as PendingFile;
        const file = entry as File;
        // webkitRelativePath = "Dossier/sous/fichier.txt" → on garde le dossier
        const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? "";
        const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
        return { file, relativePath: dir };
      });
      if (pending.length === 0) return;

      // Crée l'arborescence AVANT d'uploader : un seul appel par dossier
      // distinct, mis en cache pour ne pas recréer 200 fois le même.
      const folderIdByPath = new Map<string, string | null>();
      folderIdByPath.set("", folderId ?? null);
      const uniqueDirs = Array.from(new Set(pending.map((p) => p.relativePath))).filter(Boolean);

      for (const dir of uniqueDirs) {
        try {
          const res = await fetch("/api/folders/ensure-path", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              path: dir.split("/").filter(Boolean),
              parentId: folderId ?? null,
              teamId: teamId ?? null,
            }),
          });
          const data = await res.json().catch(() => null);
          folderIdByPath.set(dir, res.ok ? data?.folderId ?? null : folderId ?? null);
        } catch {
          // Dossier non créé → le fichier atterrit dans le dossier courant
          // plutôt que d'échouer complètement.
          folderIdByPath.set(dir, folderId ?? null);
        }
      }

      const newItems: UploadItem[] = pending.map((p, i) => ({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        file: p.file,
        progress: 0,
        status: "queued",
        targetFolderId: folderIdByPath.get(p.relativePath) ?? folderId ?? null,
        relativePath: p.relativePath ? `${p.relativePath}/${p.file.name}` : undefined,
      }));
      setItems((prev) => [...prev, ...newItems]);
      await runQueue(newItems);
    },
    [runQueue, folderId, teamId]
  );

  // Drag-drop global : dropper depuis n'importe où sur la page (pas seulement
  // dans la dropzone) déclenche l'upload. On utilise un compteur pour gérer
  // les enter/leave imbriqués sans flicker — dragenter incremente, dragleave
  // decremente. Quand le compteur retombe à 0, on cache l'overlay.
  useEffect(() => {
    function hasFiles(e: DragEvent) {
      return e.dataTransfer?.types?.includes("Files") ?? false;
    }
    function onEnter(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      setPageDragOver(true);
    }
    function onOver(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
    }
    function onLeave(e: DragEvent) {
      if (!hasFiles(e)) return;
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setPageDragOver(false);
    }
    function onDrop(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current = 0;
      setPageDragOver(false);
      if (!e.dataTransfer) return;
      // Parcourt l'arborescence : déposer un DOSSIER envoie tout son contenu
      // en recréant la structure côté cloud.
      filesFromDataTransfer(e.dataTransfer).then((pending) => {
        if (pending.length) handleFiles(pending);
      });
    }
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFiles]);

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          filesFromDataTransfer(e.dataTransfer).then((pending) => {
            if (pending.length) handleFiles(pending);
          });
        }}
        className={`tile transition-all ${
          dragOver ? "border-[var(--accent)] bg-[var(--background-elevated)]" : ""
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {/* Second input avec webkitdirectory : sélectionne un DOSSIER entier.
            Attribut non standard côté types React, d'où le cast. */}
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = ""; // permet de re-sélectionner le même dossier
          }}
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        />
        <div className="flex flex-col items-center justify-center text-center py-6">
          <div className="tile-icon mb-3">
            <Upload className="size-6" />
          </div>
          <p className="font-semibold">Dépose tes fichiers ou tes dossiers ici</p>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">
            L&apos;arborescence des dossiers est conservée.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              className="btn-ghost text-sm"
            >
              <FileUp className="size-4" />
              Choisir des fichiers
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                folderInputRef.current?.click();
              }}
              className="btn-ghost text-sm"
            >
              <FolderUp className="size-4" />
              Choisir un dossier
            </button>
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="fixed bottom-6 end-6 w-96 max-w-[calc(100vw-3rem)] z-50 space-y-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-elevated)] shadow-2xl overflow-hidden">
            {/* En-tête : ce que l'utilisateur regarde pendant un gros import.
                Il doit y trouver trois réponses — où j'en suis, combien de
                temps il reste, et est-ce que c'est fini. */}
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                {batchState.running ? (
                  <Loader2 className="size-4 text-[var(--accent)] animate-spin" />
                ) : batchState.failed > 0 ? (
                  <AlertCircle className="size-4 text-[var(--danger)]" />
                ) : (
                  <CheckCircle2 className="size-4 text-[var(--success)]" />
                )}
                <span className="font-medium text-sm">
                  {batchState.running
                    ? `Import en cours — ${batchState.done + batchState.failed}/${batchState.total}`
                    : batchState.failed > 0
                      ? `Terminé avec ${batchState.failed} échec(s)`
                      : `Import terminé — ${batchState.done} fichier(s)`}
                </span>
              </div>

              {batchState.running && totalBytesRef.current > 0 && (
                <>
                  <div className="mt-2 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] transition-all"
                      style={{
                        width: `${Math.min(100, Math.round((bytesDoneRef.current / totalBytesRef.current) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-[var(--foreground-muted)] mt-1.5">
                    {formatBytes(bytesDoneRef.current)} sur {formatBytes(totalBytesRef.current)}
                    {(() => {
                      const elapsed = (Date.now() - startedAtRef.current) / 1000;
                      // Pas d'estimation avant 2 s : sur un démarrage la
                      // vitesse est erratique et afficherait « 4 h restantes »
                      // pendant un instant, ce qui inquiète pour rien.
                      if (elapsed < 2 || bytesDoneRef.current <= 0) return null;
                      const speed = bytesDoneRef.current / elapsed;
                      const remaining = (totalBytesRef.current - bytesDoneRef.current) / speed;
                      return ` · ${formatBytes(speed)}/s · ${formatEta(remaining)} restantes`;
                    })()}
                  </p>
                </>
              )}

              {!batchState.running && batchState.failed > 0 && (
                <p className="text-xs text-[var(--danger)] mt-1.5">
                  Les fichiers en rouge n&apos;ont pas été importés. Réessaie-les
                  ou vérifie ton espace disponible.
                </p>
              )}
            </div>
            <ul className="max-h-80 overflow-y-auto divide-y divide-[var(--border)]">
              {items.map((item) => (
                <li key={item.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{item.file.name}</p>
                    <p className="text-xs text-[var(--foreground-muted)]">{formatBytes(item.file.size)}</p>
                    {item.status === "uploading" || item.status === "completing" ? (
                      <div className="mt-1 h-1 rounded-full bg-[var(--border)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--accent)] transition-all"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    ) : null}
                    {item.status === "error" && (
                      <p className="text-xs text-[var(--danger)] mt-1">{item.error}</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {item.status === "done" && <CheckCircle2 className="size-5 text-[var(--success)]" />}
                    {item.status === "error" && <AlertCircle className="size-5 text-[var(--danger)]" />}
                    {(item.status === "uploading" || item.status === "completing" || item.status === "queued") && (
                      <span className="text-xs text-[var(--foreground-muted)]">{item.progress}%</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <button
              className="w-full px-4 py-2 text-xs text-[var(--foreground-muted)] hover:bg-[var(--background-tile)]"
              onClick={() => setItems([])}
            >
              <X className="size-3 inline me-1" />
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* FAB upload mobile uniquement — bouton flottant rond accent, positionné
          au-dessus du mobile bottom bar (qui prend ~5rem). Sur desktop il est
          masqué (md:hidden) puisqu'on a déjà la zone dropzone bien visible. */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="md:hidden fixed end-4 bottom-24 z-30 size-14 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[0_8px_24px_-4px_var(--accent-glow)] hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
        aria-label="Uploader un fichier"
      >
        <Plus className="size-7" strokeWidth={2.4} />
      </button>

      {/* Overlay full-page : se déclenche quand un fichier est draggé depuis
          le bureau ou un autre onglet. Animation au scale + couleur accent. */}
      {mounted && pageDragOver &&
        createPortal(
          <div className="fixed inset-0 z-[180] bg-[var(--accent)]/10 backdrop-blur-sm pointer-events-none flex items-center justify-center animate-fade-in">
            <div className="rounded-3xl border-4 border-dashed border-[var(--accent)] bg-[var(--background-elevated)]/90 px-10 py-12 text-center animate-slide-down">
              <CloudUpload className="size-16 text-[var(--accent)] mx-auto mb-4" strokeWidth={1.5} />
              <p className="text-2xl font-bold">Lâche tes fichiers ici</p>
              <p className="text-sm text-[var(--foreground-muted)] mt-2">
                Multi-fichiers OK · uploadé dans {folderId ? "ce dossier" : "ton espace"}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
