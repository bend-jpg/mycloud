"use client";

// Visionneuse de documents Word (.docx) — LECTURE SEULE.
//
// Avant, un .docx n'affichait qu'une icône et un bouton de téléchargement :
// il fallait sortir de l'application pour lire trois lignes. Ici le document
// est converti en HTML côté serveur et affiché directement.
//
// Pas de bouton « modifier », et c'est volontaire : on ne sait pas
// reconstruire un .docx à partir de l'HTML sans détruire sa mise en page.
// Un bouton qui abîme silencieusement les documents serait pire que pas de
// bouton du tout. C'est écrit dans l'interface pour que l'utilisateur ne
// cherche pas une fonction qui n'existe pas.
//
// L'HTML est nettoyé côté serveur (liste blanche de balises) car le document
// peut venir d'un tiers via un partage.

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Download, FileText, Eye } from "lucide-react";

interface Props {
  fileId: string;
  fileName: string;
  downloadUrl: string;
}

export function FileDocViewer({ fileId, fileName, downloadUrl }: Props) {
  const [loading, setLoading] = useState(true);
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="w-full h-full max-w-4xl flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-white/60" />
      </div>
    );
  }

  if (error) {
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
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-white/40 inline-flex items-center gap-1">
            <Eye className="size-3" />
            Lecture seule
          </span>
          <a
            href={downloadUrl}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-white/10 text-white hover:bg-white/20 inline-flex items-center gap-1.5"
          >
            <Download className="size-3.5" />
            Télécharger
          </a>
        </div>
      </div>

      <div className="px-3 py-2 bg-white/5 text-white/50 text-[11px] border-b border-white/10">
        Pour modifier ce document, télécharge-le, ouvre-le dans Word, puis
        réimporte-le. La modification en ligne des documents Word demande une
        suite bureautique dédiée.
      </div>

      {/* Fond clair et couleurs explicites : le document est écrit pour du
          papier blanc, l'afficher sur fond sombre le rendrait illisible. */}
      <div className="flex-1 overflow-auto bg-white">
        <article
          className="docx-content mx-auto max-w-[820px] px-10 py-10 text-[#1a1a1a] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
