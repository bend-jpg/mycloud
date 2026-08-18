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
 * Nombre d'envois d'octets simultanés.
 *
 * Les octets partent DIRECTEMENT chez l'hébergeur de stockage, sans transiter
 * par notre serveur : on peut donc en paralléliser davantage sans risque pour
 * lui. Ce qui l'écroulait auparavant, c'étaient les requêtes de préparation
 * et de confirmation — elles passent désormais par lots.
 *
 * Six : de quoi saturer une connexion domestique sans que le navigateur ne
 * mette lui-même les requêtes en file d'attente.
 */
const MAX_PARALLEL = 6;

/**
 * Fichiers préparés et confirmés en UN SEUL appel serveur.
 *
 * C'est ce qui rend un gros import tenable. Mesuré chez l'utilisateur :
 * 83 802 fichiers pour 3,94 Go, soit 47 Ko en moyenne. À deux appels par
 * fichier, ça faisait plus de 167 000 appels de fonction serveur — 37 Ko/s
 * constatés et plus de 25 heures annoncées, pour des octets qui passent en
 * moins d'une heure. Par lots de 100 : 1 678 appels.
 */
const SERVER_BATCH = 100;

/**
 * Au-delà de ce nombre de fichiers, aucune vignette n'est générée.
 *
 * Chaque vignette est une requête supplémentaire. Sur quelques photos c'est
 * un confort ; sur des dizaines de milliers de fichiers, c'est des heures
 * perdues pour un gain invisible.
 */
const THUMBNAIL_LIMIT = 200;

/** Tentatives supplémentaires en cas d'erreur passagère (réseau, serveur). */
const MAX_RETRIES = 2;

/**
 * Nombre maximum de lignes affichées dans le panneau d'import.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUI BLOQUAIT TOUT
 * ─────────────────────────────────────────────────────────────────────────
 *
 * La version précédente plaçait la TOTALITÉ des fichiers dans l'affichage
 * avant de commencer : sur un dossier de 83 000 fichiers, le navigateur
 * devait dessiner 83 000 lignes d'un seul coup. Il gelait, et l'import ne
 * démarrait jamais — les dossiers étaient créés, aucun fichier ne partait,
 * et aucune progression ne s'affichait.
 *
 * Constaté chez l'utilisateur : 1 198 dossiers créés, zéro fichier, même pas
 * en attente. Le symptôme (« ça n'a pas montré le temps ») était en réalité
 * la cause.
 *
 * Seuls le lot en cours et les erreurs sont désormais affichés. Le compte
 * total, lui, vient des compteurs — pas de la liste.
 */
const MAX_VISIBLE_ERRORS = 100;

/**
 * Fichiers créés par le système, jamais voulus par l'utilisateur.
 *
 * Vus dans un import réel : des .DS_Store de 34 Ko — de simples métadonnées
 * d'affichage macOS — envoyés parmi les fichiers d'un site. Ils encombrent le
 * cloud, consomment du quota, et personne ne les cherchera jamais.
 */
const SYSTEM_JUNK = /^(\.DS_Store|Thumbs\.db|desktop\.ini|\.localized|__MACOSX)$/i;

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
  /**
   * Message affiché AVANT que les envois ne commencent.
   *
   * Sur un gros dossier, l'analyse de l'arborescence et la création des
   * dossiers prennent du temps — 1 198 dossiers chez l'utilisateur. Sans
   * message, l'écran reste muet et on croit qu'il ne se passe rien.
   */
  const [preparing, setPreparing] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  /** Overlay plein-écran quand un drag arrive depuis l'extérieur (bureau, autre onglet). */
  const [pageDragOver, setPageDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /**
   * Envoie les octets d'UN fichier vers l'URL signée fournie par le lot.
   *
   * Les erreurs réseau passagères sont réessayées : sur un import de
   * plusieurs milliers de fichiers, il suffit qu'une requête tombe pour
   * qu'un fichier manque définitivement, sans qu'on le remarque au milieu
   * de la liste.
   */
  const uploadBytes = useCallback(
    async (
      item: UploadItem,
      target: { uploadUrl: string; method: string; headers: Record<string, string> },
      attempt = 0,
    ): Promise<boolean> => {
      const update = (patch: Partial<UploadItem>) =>
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));

      try {
        update({ status: "uploading" });
        let lastLoaded = 0;
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open(target.method, target.uploadUrl);
          for (const [k, v] of Object.entries(target.headers ?? {})) xhr.setRequestHeader(k, v);
          xhr.upload.onprogress = (e) => {
            if (!e.lengthComputable) return;
            // Compteur GLOBAL : sert à la vitesse et au temps restant sur
            // l'ensemble de l'import, pas fichier par fichier.
            bytesDoneRef.current += e.loaded - lastLoaded;
            lastLoaded = e.loaded;
            update({ progress: Math.round((e.loaded / e.total) * 100) });
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`PUT ${xhr.status}`));
          xhr.onerror = () => reject(new Error("Erreur réseau"));
          xhr.ontimeout = () => reject(new Error("Délai dépassé"));
          xhr.send(item.file);
        });
        update({ status: "completing", progress: 100 });
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Erreur";
        if (attempt < MAX_RETRIES) {
          // Les octets déjà comptés pour cette tentative sont retirés, sinon
          // la progression globale dépasserait 100 %.
          bytesDoneRef.current = Math.max(0, bytesDoneRef.current - item.file.size * (item.progress / 100));
          update({ status: "queued", progress: 0, error: undefined });
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          return uploadBytes(item, target, attempt + 1);
        }
        update({ status: "error", error: message });
        return false;
      }
    },
    [],
  );

  /**
   * Traite l'ensemble des fichiers, PAR LOTS.
   *
   * ─────────────────────────────────────────────────────────────────────
   * POURQUOI DES LOTS
   * ─────────────────────────────────────────────────────────────────────
   *
   * La version précédente faisait deux appels au serveur PAR FICHIER : un
   * pour préparer l'envoi, un pour le confirmer. Sur l'import d'un dossier
   * de site web — mesuré chez l'utilisateur : 83 802 fichiers pour 3,94 Go,
   * soit 47 Ko en moyenne — ça représentait plus de 160 000 appels de
   * fonction serveur. Ce n'était plus la bande passante qui limitait mais
   * l'attente : 37 Ko/s constatés, plus de 25 heures annoncées, pour des
   * octets qui passent en moins d'une heure.
   *
   * Un lot prépare et confirme 100 fichiers à la fois. Les octets, eux,
   * partent directement chez l'hébergeur de stockage sans passer par notre
   * serveur : on peut donc en envoyer plus en parallèle sans risque pour
   * lui — c'était la cause des échecs en masse précédents.
   */
  const runQueue = useCallback(
    async (queue: UploadItem[]) => {
      if (queue.length === 0) return;

      startedAtRef.current = Date.now();
      bytesDoneRef.current = 0;
      totalBytesRef.current = queue.reduce((s, i) => s + i.file.size, 0);
      setBatchState({ running: true, total: queue.length, done: 0, failed: 0 });

      const ticker = setInterval(() => setTick((t) => t + 1), 500);
      // Les vignettes ajoutent une requête par image. Sur un gros import
      // c'est du temps perdu pour un confort mineur : on les réserve aux
      // petites sélections.
      const withThumbnails = queue.length <= THUMBNAIL_LIMIT;

      let done = 0;
      let failed = 0;

      for (let start = 0; start < queue.length; start += SERVER_BATCH) {
        const lot = queue.slice(start, start + SERVER_BATCH);

        // L'affichage ne contient que le lot en cours et les erreurs déjà
        // rencontrées. Y mettre les 83 000 fichiers gelait le navigateur
        // avant même le premier envoi.
        setItems((prev) => [
          ...prev.filter((i) => i.status === "error").slice(-MAX_VISIBLE_ERRORS),
          ...lot,
        ]);

        // 1. UN appel pour préparer tout le lot.
        // Aligné sur le lot : une entrée par fichier, `null` pour ceux qui
        // n'ont pas à être envoyés (déjà présents, ou refusés).
        let prepared: ({ fileId: string; uploadUrl: string; method: string; headers: Record<string, string> } | null)[];
        let dejaPresents: number[] = [];
        try {
          const res = await fetch("/api/files/upload-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teamId: teamId ?? null,
              files: lot.map((i) => ({
                name: i.file.name,
                size: i.file.size,
                mimeType: i.file.type || "application/octet-stream",
                folderId: i.targetFolderId !== undefined ? i.targetFolderId : folderId ?? null,
              })),
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => null);
            const message =
              err?.error === "QUOTA_EXCEEDED"
                ? "Quota de stockage dépassé"
                : err?.error === "READ_ONLY"
                  ? "Tu n'as pas le droit d'écrire ici"
                  : (err?.message ?? err?.error ?? "Préparation impossible");
            throw new Error(message);
          }
          const data = await res.json();
          prepared = data.files;
          dejaPresents = data.skipped ?? [];
        } catch (e) {
          // Tout le lot échoue : chaque fichier reçoit le message, sinon
          // l'utilisateur voit des lignes rouges sans explication.
          const message = e instanceof Error ? e.message : "Erreur";
          setItems((prev) =>
            prev.map((i) => (lot.some((l) => l.id === i.id) ? { ...i, status: "error", error: message } : i)),
          );
          failed += lot.length;
          setBatchState({ running: true, total: queue.length, done, failed });
          continue;
        }

        // Fichiers déjà dans le cloud : comptés comme faits, sans rien
        // renvoyer. C'est ce qui permet de reprendre un import interrompu en
        // re-sélectionnant le dossier, au lieu de tout refaire.
        const skipSet = new Set(dejaPresents);
        if (skipSet.size > 0) {
          done += skipSet.size;
          // Leurs octets ne partiront pas : on les retire du total, sinon la
          // progression et le temps restant seraient faux.
          for (const idx of skipSet) totalBytesRef.current -= lot[idx]?.file.size ?? 0;
          setItems((prev) =>
            prev.map((i) => {
              const idx = lot.findIndex((l) => l.id === i.id);
              return idx !== -1 && skipSet.has(idx) ? { ...i, status: "done", progress: 100 } : i;
            }),
          );
        }

        // 2. Envoi des octets, en parallèle et directement vers le stockage.
        const uploaded: string[] = [];
        let cursor = 0;
        const worker = async () => {
          while (cursor < lot.length) {
            const index = cursor++;
            if (skipSet.has(index)) continue;
            const target = prepared[index];
            // Fichier écarté par le serveur (trop volumineux pour le plan).
            if (!target) {
              setItems((prev) =>
                prev.map((i) =>
                  i.id === lot[index].id
                    ? { ...i, status: "error", error: "Trop volumineux pour ton plan" }
                    : i,
                ),
              );
              failed++;
              continue;
            }
            const ok = await uploadBytes(lot[index], target);
            if (ok) uploaded.push(target.fileId);
            else failed++;
            setBatchState({ running: true, total: queue.length, done, failed });
          }
        };
        await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL, lot.length) }, worker));

        // 3. UN appel pour confirmer tout le lot.
        if (uploaded.length > 0) {
          try {
            const res = await fetch("/api/files/complete-batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileIds: uploaded }),
            });
            if (!res.ok) throw new Error("Confirmation impossible");
            const data = await res.json();

            // Les fichiers portant un nom déjà présent passent par l'ancienne
            // route, qui sait archiver l'existant en version.
            for (const id of data.needsMerge ?? []) {
              await fetch(`/api/files/${id}/complete`, { method: "POST" }).catch(() => undefined);
            }

            const okIds = new Set<string>([...(data.completed ?? []), ...(data.needsMerge ?? [])]);
            const missing = new Set<string>(data.missing ?? []);
            done += okIds.size;
            failed += missing.size;

            setItems((prev) =>
              prev.map((i) => {
                const idx = lot.findIndex((l) => l.id === i.id);
                if (idx === -1) return i;
                const fid = prepared[idx]?.fileId;
                if (fid && okIds.has(fid)) return { ...i, status: "done", progress: 100 };
                if (fid && missing.has(fid)) return { ...i, status: "error", error: "Fichier non reçu" };
                return i;
              }),
            );
          } catch {
            setItems((prev) =>
              prev.map((i) =>
                lot.some((l) => l.id === i.id) && i.status === "completing"
                  ? { ...i, status: "error", error: "Échec de la confirmation" }
                  : i,
              ),
            );
            failed += uploaded.length;
          }
        }

        setBatchState({ running: true, total: queue.length, done, failed });

        // 4. Vignettes — best-effort, uniquement sur les petites sélections.
        if (withThumbnails) {
          await Promise.all(
            lot.map(async (item, index) => {
              const fid = prepared[index]?.fileId;
              if (!fid) return;
              try {
                const thumb = await makeThumbnail(item.file);
                if (thumb) {
                  await fetch(`/api/files/${fid}/thumbnail`, {
                    method: "PUT",
                    headers: { "Content-Type": "image/jpeg" },
                    body: thumb,
                  });
                }
              } catch {
                // vignette optionnelle
              }
            }),
          );
        }

      }

      clearInterval(ticker);
      setBatchState({ running: false, total: queue.length, done, failed });

      // Un SEUL rafraîchissement, à la fin.
      router.refresh();

      if (failed === 0) {
        toast.success(
          queue.length === 1 ? `« ${queue[0].file.name} » importé` : `${done} fichier(s) importés`,
        );
        setTimeout(() => setItems((prev) => prev.filter((i) => i.status !== "done")), 2500);
      } else {
        // En cas d'échec on ne referme RIEN : l'utilisateur doit voir quels
        // fichiers manquent, sinon il repart en croyant l'import complet.
        toast.error(`${failed} fichier(s) non importés sur ${queue.length}`);
      }
    },
    [uploadBytes, router, toast, folderId, teamId],
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

      // Écarte les fichiers créés par le système d'exploitation. Ils ne
      // servent à rien dans un cloud, et sur un import de plusieurs dizaines
      // de milliers de fichiers ils représentent des centaines d'envois
      // inutiles.
      const junkCount = pending.filter((p) => SYSTEM_JUNK.test(p.file.name)).length;
      const kept = pending.filter((p) => !SYSTEM_JUNK.test(p.file.name));
      if (junkCount > 0) {
        toast.success(
          junkCount === 1
            ? "1 fichier système ignoré"
            : `${junkCount} fichiers système ignorés (.DS_Store, Thumbs.db…)`,
        );
      }
      if (kept.length === 0) return;
      pending.length = 0;
      pending.push(...kept);

      // Crée l'arborescence AVANT d'uploader : un seul appel par dossier
      // distinct, mis en cache pour ne pas recréer 200 fois le même.
      const folderIdByPath = new Map<string, string | null>();
      folderIdByPath.set("", folderId ?? null);
      const uniqueDirs = Array.from(new Set(pending.map((p) => p.relativePath))).filter(Boolean);

      // Création de l'arborescence, NIVEAU PAR NIVEAU.
      //
      // En séquentiel, un site de plusieurs milliers de dossiers demandait
      // autant d'allers-retours AVANT que le moindre fichier ne parte —
      // plusieurs minutes d'attente sans que rien ne bouge à l'écran.
      //
      // On ne peut pas tout paralléliser pour autant : deux chemins frères
      // créés en même temps risqueraient de créer deux fois leur parent
      // commun. En traitant les niveaux dans l'ordre de profondeur, chaque
      // parent existe déjà quand ses enfants sont demandés, et les dossiers
      // d'un même niveau peuvent partir ensemble sans risque.
      const byDepth = new Map<number, string[]>();
      for (const dir of uniqueDirs) {
        const depth = dir.split("/").filter(Boolean).length;
        if (!byDepth.has(depth)) byDepth.set(depth, []);
        byDepth.get(depth)!.push(dir);
      }

      let dossiersFaits = 0;
      const ensureOne = async (dir: string) => {
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
          folderIdByPath.set(dir, res.ok ? (data?.folderId ?? null) : (folderId ?? null));
        } catch {
          // Dossier non créé → le fichier atterrit dans le dossier courant
          // plutôt que d'échouer complètement.
          folderIdByPath.set(dir, folderId ?? null);
        }
        dossiersFaits++;
        // Un message toutes les 20 créations : suffisant pour montrer que ça
        // avance, sans redessiner l'écran en permanence.
        if (dossiersFaits % 20 === 0 || dossiersFaits === uniqueDirs.length) {
          setPreparing(`Création des dossiers — ${dossiersFaits}/${uniqueDirs.length}`);
        }
      };

      if (uniqueDirs.length > 0) {
        setPreparing(`Création des dossiers — 0/${uniqueDirs.length}`);
      }

      for (const depth of Array.from(byDepth.keys()).sort((a, b) => a - b)) {
        const level = byDepth.get(depth)!;
        let cursor = 0;
        await Promise.all(
          Array.from({ length: Math.min(MAX_PARALLEL, level.length) }, async () => {
            while (cursor < level.length) await ensureOne(level[cursor++]);
          }),
        );
      }

      const newItems: UploadItem[] = pending.map((p, i) => ({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        file: p.file,
        progress: 0,
        status: "queued",
        targetFolderId: folderIdByPath.get(p.relativePath) ?? folderId ?? null,
        relativePath: p.relativePath ? `${p.relativePath}/${p.file.name}` : undefined,
      }));
      setPreparing(null);
      // Les éléments ne sont PAS tous placés dans l'affichage : c'est ce qui
      // faisait geler le navigateur sur un gros dossier, avant même que le
      // premier fichier ne parte. runQueue n'affiche que le lot en cours.
      await runQueue(newItems);
    },
    [runQueue, folderId, teamId]
  );

  /**
   * Protection contre l'interruption d'un import en cours.
   *
   * L'envoi vit dans ce composant. Cliquer sur un dossier, un lien du menu ou
   * le bouton retour change de page, démonte le composant, et les envois en
   * cours sont abandonnés SANS AUCUN MESSAGE : l'utilisateur croit que son
   * import continue alors qu'il vient de le tuer.
   *
   * Deux garde-fous :
   *   – les liens internes demandent confirmation (interception en phase de
   *     capture, donc avant que la navigation ne parte) ;
   *   – fermer ou recharger l'onglet déclenche l'avertissement du navigateur.
   */
  useEffect(() => {
    if (!batchState.running) return;

    function onClickCapture(e: MouseEvent) {
      // Clic modifié (nouvel onglet) ou bouton secondaire : la page actuelle
      // reste, l'import n'est pas menacé.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      if (link.target === "_blank" || link.hasAttribute("download")) return;

      const stay = !confirm(
        "Un import est en cours.\n\n" +
          "Quitter cette page l'interrompt : les fichiers non encore envoyés " +
          "ne seront pas importés.\n\n" +
          "Quitter quand même ?",
      );
      if (stay) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Les navigateurs modernes ignorent le texte, mais exigent que la
      // valeur de retour soit définie pour afficher leur propre message.
      e.returnValue = "";
    }

    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [batchState.running]);

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

      {(items.length > 0 || preparing !== null) && (
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
                  {preparing
                    ? preparing
                    : batchState.running
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
