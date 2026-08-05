"use client";

// Visionneuse + ÉDITEUR de fichiers texte (code, HTML, CSV, JSON, markdown…).
//
// Remplace l'ancien <iframe src={previewUrl}> qui affichait le texte en
// blanc sur blanc : les classes Tailwind (bg-white text-black) s'appliquaient
// au CADRE, pas au document chargé dedans — le navigateur rendait donc le
// texte avec ses couleurs par défaut (claires en thème sombre) sur fond
// blanc. Illisible tant qu'on ne sélectionnait pas le texte.
//
// Ici on récupère le contenu en JSON et on le rend nous-mêmes, avec des
// couleurs explicites, la numérotation des lignes, et un mode édition qui
// enregistre directement dans le cloud (nouvelle version archivée).

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pencil, Save, X, AlertCircle, Download, WrapText } from "lucide-react";

interface Props {
  fileId: string;
  fileName: string;
  downloadUrl: string;
}

export function FileTextEditor({ fileId, fileName, downloadUrl }: Props) {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [wrap, setWrap] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/files/${fileId}/content`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => null);
          if (data?.error === "TOO_LARGE") throw new Error("Fichier trop volumineux pour l'aperçu texte (max 5 Mo).");
          if (data?.error === "NOT_TEXT") throw new Error("Ce format ne s'ouvre pas en texte.");
          throw new Error("Impossible de charger le contenu.");
        }
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setContent(data.content ?? "");
        setDraft(data.content ?? "");
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

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/${fileId}/content`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.error === "QUOTA_EXCEEDED") throw new Error("Quota dépassé — libère de l'espace.");
        if (data?.error === "FORBIDDEN") throw new Error("Tu n'as pas le droit de modifier ce fichier.");
        throw new Error("Enregistrement impossible.");
      }
      setContent(draft);
      setEditing(false);
      setSavedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }, [draft, fileId, saving]);

  // Ctrl/Cmd+S enregistre, Échap quitte l'édition
  useEffect(() => {
    if (!editing) return;
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        save();
      } else if (e.key === "Escape") {
        // Empêche la fermeture de la modale d'aperçu pendant l'édition
        e.stopPropagation();
        if (draft !== content) {
          if (confirm("Abandonner les modifications non enregistrées ?")) {
            setDraft(content);
            setEditing(false);
          }
        } else {
          setEditing(false);
        }
      }
    }
    // capture: true → on intercepte avant le handler Échap de la modale
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [editing, draft, content, save]);

  const dirty = editing && draft !== content;
  const lineCount = (editing ? draft : content).split("\n").length;

  if (loading) {
    return (
      <div className="w-full h-full max-w-5xl flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-white/60" />
      </div>
    );
  }

  if (error && !content) {
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

  return (
    <div className="w-full h-full max-w-5xl flex flex-col rounded-lg overflow-hidden shadow-2xl bg-[#12151d] border border-white/10">
      {/* Barre d'outils */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#0e1119] border-b border-white/10 shrink-0">
        <div className="text-xs text-white/50 font-mono truncate">
          {lineCount} ligne{lineCount > 1 ? "s" : ""}
          {dirty && <span className="ms-2 text-amber-400">• non enregistré</span>}
          {savedAt && !dirty && <span className="ms-2 text-emerald-400">• enregistré</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setWrap((w) => !w)}
            title={wrap ? "Désactiver le retour à la ligne" : "Activer le retour à la ligne"}
            aria-pressed={wrap}
            className={`p-1.5 rounded-lg text-xs ${wrap ? "bg-white/20 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
          >
            <WrapText className="size-4" />
          </button>
          {editing ? (
            <>
              <button
                onClick={() => {
                  if (dirty && !confirm("Abandonner les modifications non enregistrées ?")) return;
                  setDraft(content);
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
              onClick={() => {
                setEditing(true);
                setTimeout(() => textareaRef.current?.focus(), 50);
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs bg-white/10 text-white hover:bg-white/20 inline-flex items-center gap-1.5"
            >
              <Pencil className="size-3.5" />
              Modifier
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 bg-[var(--danger)]/15 text-[var(--danger)] text-xs border-b border-[var(--danger)]/30">
          {error}
        </div>
      )}

      {/* Contenu — couleurs explicites, jamais héritées du navigateur */}
      <div className="flex-1 overflow-auto">
        {editing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className={`w-full h-full min-h-[50vh] bg-[#12151d] text-[#e6e6ef] font-mono text-[13px] leading-relaxed p-4 outline-none resize-none ${
              wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre overflow-x-auto"
            }`}
          />
        ) : (
          <pre
            className={`text-[#e6e6ef] font-mono text-[13px] leading-relaxed p-4 m-0 select-text ${
              wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre"
            }`}
          >
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
