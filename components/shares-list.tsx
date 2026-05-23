"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Trash2, Lock, Clock, Download, Share2 } from "lucide-react";
import { FileIcon } from "./file-icon";
import { EmptyState } from "./empty-state";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast";
import { formatBytes } from "@/lib/utils";

export interface ShareItem {
  token: string;
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: string;
  expiresAt: string | null;
  maxDownloads: number | null;
  downloadCount: number;
  hasPassword: boolean;
  customMessage: string | null;
  createdAt: string;
}

export function SharesList({ items }: { items: ShareItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<{ token: string; fileName: string } | null>(null);

  async function copy(token: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  async function performRevoke() {
    if (!confirmRevoke) return;
    const res = await fetch(`/api/shares/${confirmRevoke.token}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Lien révoqué");
      router.refresh();
    } else {
      toast.error("Échec de la révocation");
    }
    setConfirmRevoke(null);
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Share2}
        variant="violet"
        title="Aucun lien partagé pour l'instant"
        description={
          <>
            Crée un lien à durée limitée pour envoyer un fichier à n&apos;importe qui.
            Date d&apos;expiration, mot de passe, limite de téléchargements — tu contrôles tout.
          </>
        }
        cta={{ label: "Aller à mes fichiers", href: "/files" }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const expired = item.expiresAt && new Date(item.expiresAt) < new Date();
        const exhausted = item.maxDownloads != null && item.downloadCount >= item.maxDownloads;
        return (
          <div
            key={item.token}
            className={`tile cursor-default !min-h-0 !p-4 flex flex-col sm:flex-row sm:items-center gap-4 ${
              expired || exhausted ? "opacity-50" : ""
            }`}
          >
            <FileIcon mimeType={item.mimeType} className="size-10 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate" title={item.fileName}>{item.fileName}</p>
              <div className="flex flex-wrap gap-3 mt-1 text-xs text-[var(--foreground-muted)]">
                <span>{formatBytes(Number(item.fileSize))}</span>
                <span className="flex items-center gap-1">
                  <Download className="size-3" />
                  {item.downloadCount}
                  {item.maxDownloads != null ? ` / ${item.maxDownloads}` : ""}
                </span>
                {item.expiresAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    Expire {new Date(item.expiresAt).toLocaleDateString()}
                  </span>
                )}
                {item.hasPassword && (
                  <span className="flex items-center gap-1">
                    <Lock className="size-3" />
                    Mot de passe
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => copy(item.token, item.url)}
                className="btn-ghost text-xs flex-1 sm:flex-none"
              >
                {copied === item.token ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied === item.token ? "Copié !" : "Copier"}
              </button>
              <button
                onClick={() => setConfirmRevoke({ token: item.token, fileName: item.fileName })}
                className="btn-ghost text-xs !text-[var(--danger)]"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        );
      })}
      <ConfirmDialog
        open={!!confirmRevoke}
        title="Révoquer ce lien de partage ?"
        message={
          confirmRevoke && (
            <>
              Le lien de <strong>{confirmRevoke.fileName}</strong> ne sera plus accessible — toute
              personne qui l&apos;avait verra une page « expiré ».
            </>
          )
        }
        confirmLabel="Révoquer"
        destructive
        onClose={() => setConfirmRevoke(null)}
        onConfirm={performRevoke}
      />
    </div>
  );
}
