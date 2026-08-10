"use client";

// Lecture et MODIFICATION d'un document Word (.docx) dans le cloud.
//
// Avant, un .docx n'affichait qu'une icône et un bouton de téléchargement :
// il fallait sortir de l'application pour lire ou corriger trois lignes.
//
// La modification a d'abord été écartée parce qu'un aller-retour
// docx → HTML → docx ne restitue pas la mise en page à l'identique. Le
// besoin ayant été confirmé, elle est activée — mais l'utilisateur est
// prévenu AVANT d'enregistrer, une seule fois par document, et l'ancienne
// version reste récupérable pendant 72 heures.
//
// L'édition se fait dans un bloc contentEditable : c'est ce qui permet de
// garder les titres, le gras, les listes et les tableaux tels qu'ils sont
// affichés. L'HTML renvoyé est renettoyé côté serveur — le nettoyage fait
// ici ne prouve rien, il suffirait d'appeler l'API directement.

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, Download, FileText, Pencil, Save, X } from "lucide-react";

interface Props {
  fileId: string;
  fileName: string;
  downloadUrl: string;
}

export function FileDocViewer({ fileId, fileName, downloadUrl }: Props) {
  const [loading, setLoading] = useState(true);
  const [html, setHtml] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const warnedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/files/${fileId}/docx`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => null);
          if (data?.error === "TOO_LARGE") throw new Error("Document trop volumineux pour l'aperçu (max 10 Mo).");
          if (data?.error === "UNREADABLE") throw new Error("Document illisible — il est peut-être protégé par mot de passe, ou au format .doc (ancien).");
          if (data?.error === "NOT_WORD_DOCUMENT") throw new Error("Ce format n'est pas un document Word .docx.");
          throw new Error("Impossible de charger le document.");
        }
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setHtml(data.html ?? "");
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
    if (saving || !editorRef.current) return;

    if (!warnedRef.current) {
      const ok = confirm(
        "Enregistrer va reconstruire le document Word.\n\n" +
          "CONSERVÉ : le texte, les titres, le gras, l'italique, les listes, " +
          "les tableaux et les liens.\n\n" +
          "PERDU : le souligné et le barré, les polices et couleurs d'origine, " +
          "les marges, les en-têtes et pieds de page, les images et les notes " +
          "de bas de page.\n\n" +
          "La version précédente reste récupérable pendant 72 heures.\n\n" +
          "Continuer ?",
      );
      if (!ok) return;
      warnedRef.current = true;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/${fileId}/docx`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: editorRef.current.innerHTML }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.error === "QUOTA_EXCEEDED") throw new Error("Quota dépassé — libère de l'espace.");
        if (data?.error === "FORBIDDEN") throw new Error("Tu n'as pas le droit de modifier ce document.");
        if (data?.error === "CONVERSION_FAILED") throw new Error("Conversion impossible — le document n'a pas été modifié.");
        throw new Error("Enregistrement impossible.");
      }
      setHtml(editorRef.current.innerHTML);
      setEditing(false);
      setDirty(false);
      setSavedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }, [fileId, saving]);

  // Ctrl/Cmd+S enregistre, Échap quitte l'édition sans fermer l'aperçu
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
        setEditing(false);
        setDirty(false);
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [editing, dirty, save]);

  if (loading) {
    return (
      <div className="w-full h-full max-w-4xl flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-white/60" />
      </div>
    );
  }

  if (error && !html) {
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
    <div className="w-full h-full max-w-4xl flex flex-col rounded-lg overflow-hidden shadow-2xl bg-[#12151d] border border-white/10">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#0e1119] border-b border-white/10 shrink-0">
        <div className="text-xs text-white/50 flex items-center gap-1.5 truncate">
          <FileText className="size-3.5 shrink-0" />
          <span className="truncate">{fileName}</span>
          {dirty && <span className="text-amber-400 shrink-0">• non enregistré</span>}
          {savedAt && !dirty && <span className="text-emerald-400 shrink-0">• enregistré</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {editing ? (
            <>
              <button
                onClick={() => {
                  if (dirty && !confirm("Abandonner les modifications non enregistrées ?")) return;
                  if (editorRef.current) editorRef.current.innerHTML = html;
                  setEditing(false);
                  setDirty(false);
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
            <>
              <button
                onClick={() => {
                  setEditing(true);
                  setTimeout(() => editorRef.current?.focus(), 50);
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-white/10 text-white hover:bg-white/20 inline-flex items-center gap-1.5"
              >
                <Pencil className="size-3.5" />
                Modifier
              </button>
              <a
                href={downloadUrl}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-white/5 text-white/70 hover:bg-white/10 inline-flex items-center gap-1.5"
              >
                <Download className="size-3.5" />
                Télécharger
              </a>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="px-3 py-2 bg-amber-500/15 text-amber-300 text-xs border-b border-amber-500/30">
          Conservés : texte, titres, gras, italique, listes, tableaux, liens.
          Perdus : souligné, barré, polices et couleurs d&apos;origine, marges,
          en-têtes et images. La version précédente reste récupérable 72 h.
        </div>
      )}

      {error && (
        <div className="px-3 py-2 bg-[var(--danger)]/15 text-[var(--danger)] text-xs border-b border-[var(--danger)]/30">
          {error}
        </div>
      )}

      {/* Fond clair et couleurs explicites : le document est écrit pour du
          papier blanc, l'afficher sur fond sombre le rendrait illisible. */}
      <div className="flex-1 overflow-auto bg-white">
        <div
          ref={editorRef}
          contentEditable={editing}
          suppressContentEditableWarning
          onInput={() => setDirty(true)}
          spellCheck={editing}
          className={`docx-content mx-auto max-w-[820px] px-10 py-10 text-[#1a1a1a] leading-relaxed outline-none ${
            editing ? "ring-2 ring-inset ring-[var(--accent)]/40" : ""
          }`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
