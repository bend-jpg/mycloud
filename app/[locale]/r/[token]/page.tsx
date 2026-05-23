// /r/[token] — page publique où n'importe qui peut envoyer des fichiers
// à l'utilisateur qui a créé le file request, sans avoir de compte.

import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PublicHeader } from "@/components/public-header";
import { SiteFooter } from "@/components/site-footer";
import { FileRequestReceiver } from "@/components/file-request-receiver";
import { Inbox, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; token: string }>;
}

export default async function FileRequestPage({ params }: PageProps) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  let request;
  try {
    request = await db.fileRequest.findUnique({
      where: { token },
      include: {
        owner: { select: { name: true, brandSenderName: true, brandLogoUrl: true, brandColor: true } },
      },
    });
  } catch {
    notFound();
  }

  if (!request) notFound();

  const isRevoked = !!request.revokedAt;
  const isExpired = !!request.expiresAt && request.expiresAt < new Date();
  const isFull = request.uploadCount >= request.maxFiles;
  const senderName = request.owner.brandSenderName || request.owner.name || "Quelqu'un";

  if (isRevoked || isExpired || isFull) {
    return (
      <>
        <PublicHeader />
        <main className="mx-auto max-w-2xl px-4 sm:px-6 py-16">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--background-tile)] p-8 text-center">
            <div className="size-16 rounded-3xl bg-[var(--danger)]/15 border border-[var(--danger)]/30 text-[var(--danger)] flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="size-8" />
            </div>
            <h1 className="text-2xl font-bold">
              {isRevoked
                ? "Lien révoqué"
                : isExpired
                ? "Lien expiré"
                : "Limite atteinte"}
            </h1>
            <p className="text-sm text-[var(--foreground-muted)] mt-2">
              {isRevoked
                ? "L'expéditeur a annulé cette demande."
                : isExpired
                ? `La date limite (${request.expiresAt?.toLocaleDateString("fr")}) est passée.`
                : `${request.maxFiles} fichier(s) ont déjà été uploadés sur ce lien.`}
            </p>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-12 space-y-6">
        <div className="rounded-3xl border border-[var(--accent)]/40 bg-gradient-to-br from-[var(--accent)]/10 via-[var(--background-tile)] to-[var(--secondary)]/5 p-8">
          <div className="size-16 rounded-3xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center mb-4">
            <Inbox className="size-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">{request.title}</h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-2">
            <strong>{senderName}</strong> te demande d&apos;envoyer des fichiers
          </p>
          {request.message && (
            <p className="mt-4 p-4 rounded-2xl bg-[var(--background-elevated)] text-sm border border-[var(--border)]">
              {request.message}
            </p>
          )}
          <div className="mt-3 text-xs text-[var(--foreground-muted)] flex flex-wrap gap-3">
            <span>Maximum {request.maxFiles} fichier(s)</span>
            <span>·</span>
            <span>Taille max : {(Number(request.maxFileSizeBytes) / 1024 / 1024 / 1024).toFixed(1)} Go par fichier</span>
            {request.expiresAt && (
              <>
                <span>·</span>
                <span>Expire le {request.expiresAt.toLocaleDateString("fr")}</span>
              </>
            )}
          </div>
        </div>

        <FileRequestReceiver
          token={token}
          hasPassword={!!request.passwordHash}
          remainingSlots={request.maxFiles - request.uploadCount}
          maxFileSizeBytes={request.maxFileSizeBytes.toString()}
        />

        <p className="text-xs text-[var(--foreground-muted)] text-center">
          Les fichiers sont envoyés en privé à <strong>{senderName}</strong> — personne d&apos;autre n&apos;y aura accès.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
