"use client";

// Éditeur de tableur .xlsx directement dans le cloud.
//
// Les fichiers Excel ne pouvaient qu'être téléchargés puis réuploadés. Ici on
// affiche une grille modifiable, et l'enregistrement reconstruit un .xlsx
// côté serveur en archivant l'ancienne version.
//
// L'analyse et la génération du fichier se font sur le serveur : ce composant
// ne manipule que des chaînes de caractères. Voir la note en tête de
// app/api/files/[id]/sheet/route.ts pour la raison.
//
// AVERTISSEMENT ASSUMÉ : enregistrer simplifie le fichier (mises en forme,
// formules, graphiques perdus). L'utilisateur doit le savoir AVANT de
// cliquer, pas le découvrir après — d'où le bandeau qui apparaît dès l'entrée
// en modification, et la confirmation explicite au premier enregistrement.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pencil, Save, X, AlertCircle, Download, Plus, Table2 } from "lucide-react";

interface Sheet {
  name: string;
  rows: string[][];
}

interface Props {
  fileId: string;
  fileName: string;
  downloadUrl: string;
}

/** Étiquette de colonne façon tableur : A, B… Z, AA, AB… */
function columnLabel(index: number): string {
  let label = "";
  let n = index;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export function FileSpreadsheetEditor({ fileId, fileName, downloadUrl }: Props) {
  const [loading, setLoading] = useState(true);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [original, setOriginal] = useState<string>("");
  const [active, setActive] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [truncated, setTruncated] = useState(false);
  const warnedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/files/${fileId}/sheet`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => null);
          if (data?.error === "TOO_LARGE") throw new Error("Tableur trop volumineux pour l'édition en ligne (max 10 Mo).");
          if (data?.error === "UNREADABLE") throw new Error("Fichier illisible — il est peut-être protégé par mot de passe, ou au format .xls (ancien).");
          if (data?.error === "NOT_SPREADSHEET") throw new Error("Ce format n'est pas un tableur .xlsx.");
          throw new Error("Impossible de charger le tableur.");
        }
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setSheets(data.sheets ?? []);
        setOriginal(JSON.stringify(data.sheets ?? []));
        setTruncated(Boolean(data.truncated));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  const dirty = useMemo(
    () => editing && JSON.stringify(sheets) !== original,
    [editing, sheets, original],
  );

  const setCell = useCallback((sheetIdx: number, row: number, col: number, value: string) => {
    setSheets((prev) =>
      prev.map((s, i) => {
        if (i !== sheetIdx) return s;
        const rows = s.rows.map((r, ri) => (ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r));
        return { ...s, rows };
      }),
    );
  }, []);

  const addRow = useCallback((sheetIdx: number) => {
    setSheets((prev) =>
      prev.map((s, i) => {
        if (i !== sheetIdx) return s;
        const width = s.rows[0]?.length ?? 1;
        return { ...s, rows: [...s.rows, Array<string>(width).fill("")] };
      }),
    );
  }, []);

  const save = useCallback(async () => {
    if (saving) return;
    // Le fichier n'a pas été chargé en entier : enregistrer effacerait les
    // lignes absentes de la grille. On refuse plutôt que de détruire.
    if (truncated) {
      setError("Tableur trop grand pour être enregistré sans perte. Télécharge-le et modifie-le dans Excel.");
      return;
    }
    if (!warnedRef.current) {
      const ok = confirm(
        "Enregistrer va reconstruire le fichier Excel.\n\n" +
          "Les valeurs seront conservées, mais les mises en forme, couleurs, " +
          "formules, graphiques et images seront perdus.\n\n" +
          "Continuer ?",
      );
      if (!ok) return;
      warnedRef.current = true;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/${fileId}/sheet`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheets }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.error === "QUOTA_EXCEEDED") throw new Error("Quota dépassé — libère de l'espace.");
        if (data?.error === "FORBIDDEN") throw new Error("Tu n'as pas le droit de modifier ce fichier.");
        throw new Error("Enregistrement impossible.");
      }
      setOriginal(JSON.stringify(sheets));
      setEditing(false);
      setSavedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }, [fileId, saving, sheets, truncated]);

  // Ctrl/Cmd+S enregistre, Échap quitte l'édition sans fermer la modale
  useEffect(() => {
    if (!editing) return;
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        save();
      } else if (e.key === "Escape") {
        e.stopPropagation();
        if (dirty && !confirm("Abandonner les modifications non enregistrées ?")) return;
        setSheets(JSON.parse(original));
        setEditing(false);
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [editing, dirty, original, save]);

  if (loading) {
    return (
      <div className="w-full h-full max-w-6xl flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-white/60" />
      </div>
    );
  }

  if (error && sheets.length === 0) {
    return (
      <div className="bg-white/5 rounded-2xl p-10 text-center max-w-md">
        <AlertCircle className="size-10 text-white/40 mx-auto mb-3" />
        <p className="text-white font-medium">{fileName}</p>
        <p className="text-sm text-white/60 mt-2">{error}</p>
        <a href={downloadUrl} className="btn-primary mt-4 inline-flex">
          <Download className="size-4" />
          Télécharger
        </a>
      </div>
    );
  }

  const sheet = sheets[active];
  const colCount = sheet?.rows.reduce((m, r) => Math.max(m, r.length), 0) ?? 0;

  return (
    <div className="w-full h-full max-w-6xl flex flex-col rounded-lg overflow-hidden shadow-2xl bg-[#12151d] border border-white/10">
      {/* Barre d'outils */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#0e1119] border-b border-white/10 shrink-0">
        <div className="text-xs text-white/50 truncate flex items-center gap-1.5">
          <Table2 className="size-3.5 shrink-0" />
          {sheet ? `${sheet.rows.length} ligne(s) × ${colCount} colonne(s)` : "Tableur vide"}
          {dirty && <span className="ms-1 text-amber-400">• non enregistré</span>}
          {savedAt && !dirty && <span className="ms-1 text-emerald-400">• enregistré</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {editing ? (
            <>
              <button
                onClick={() => addRow(active)}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-white/5 text-white/70 hover:bg-white/10 inline-flex items-center gap-1.5"
              >
                <Plus className="size-3.5" />
                Ligne
              </button>
              <button
                onClick={() => {
                  if (dirty && !confirm("Abandonner les modifications non enregistrées ?")) return;
                  setSheets(JSON.parse(original));
                  setEditing(false);
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-white/5 text-white/70 hover:bg-white/10 inline-flex items-center gap-1.5"
              >
                <X className="size-3.5" />
                Annuler
              </button>
              <button
                onClick={save}
                disabled={saving || !dirty}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-[var(--accent)] text-[var(--accent-foreground)] font-medium disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Enregistrer
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              disabled={truncated}
              title={truncated ? "Tableur trop grand pour être modifié en ligne" : undefined}
              className="px-2.5 py-1.5 rounded-lg text-xs bg-white/10 text-white hover:bg-white/20 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              <Pencil className="size-3.5" />
              Modifier
            </button>
          )}
        </div>
      </div>

      {truncated && (
        <div className="px-3 py-2 bg-amber-500/15 text-amber-300 text-xs border-b border-amber-500/30">
          Ce tableur dépasse la taille affichable : seul un extrait est montré, et
          la modification est désactivée pour ne rien effacer.
        </div>
      )}

      {editing && !truncated && (
        <div className="px-3 py-2 bg-amber-500/15 text-amber-300 text-xs border-b border-amber-500/30">
          Les valeurs seront conservées à l&apos;enregistrement. Les mises en forme,
          formules, graphiques et images seront perdus.
        </div>
      )}

      {error && (
        <div className="px-3 py-2 bg-[var(--danger)]/15 text-[var(--danger)] text-xs border-b border-[var(--danger)]/30">
          {error}
        </div>
      )}

      {/* Onglets de feuilles */}
      {sheets.length > 1 && (
        <div className="flex items-center gap-1 px-2 py-1.5 bg-[#0e1119] border-b border-white/10 overflow-x-auto shrink-0">
          {sheets.map((s, i) => (
            <button
              key={`${s.name}-${i}`}
              onClick={() => setActive(i)}
              className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap ${
                i === active ? "bg-white/15 text-white" : "text-white/50 hover:bg-white/5"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Grille */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse text-[13px] text-[#e6e6ef]">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="bg-[#0e1119] border border-white/10 px-2 py-1 text-white/30 text-[11px] font-normal w-12" />
              {Array.from({ length: colCount }, (_, c) => (
                <th
                  key={c}
                  className="bg-[#0e1119] border border-white/10 px-2 py-1 text-white/40 text-[11px] font-normal min-w-[120px]"
                >
                  {columnLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet?.rows.map((row, r) => (
              <tr key={r}>
                <td className="bg-[#0e1119] border border-white/10 px-2 py-1 text-white/30 text-[11px] text-center sticky start-0">
                  {r + 1}
                </td>
                {Array.from({ length: colCount }, (_, c) => (
                  <td key={c} className="border border-white/10 p-0">
                    {editing ? (
                      <input
                        value={row[c] ?? ""}
                        onChange={(e) => setCell(active, r, c, e.target.value)}
                        className="w-full bg-transparent px-2 py-1 outline-none focus:bg-white/10 text-[#e6e6ef]"
                      />
                    ) : (
                      <div className="px-2 py-1 truncate max-w-[280px]" title={row[c] ?? ""}>
                        {row[c] ?? ""}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
