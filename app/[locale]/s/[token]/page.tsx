import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { FileIcon } from "@/components/file-icon";
import { formatBytes } from "@/lib/utils";
import { Cloud, Clock, Download, Lock, FileX } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PublicDownloadForm } from "@/components/public-download-form";

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const link = await db.shareLink.findUnique({
    where: { token },
    include: { file: { select: { name: true, size: true, mimeType: true } } },
  });

  if (!link || link.revokedAt) notFound();

  const expired = link.expiresAt && link.expiresAt < new Date();
  const maxReached = link.maxDownloads != null && link.downloadCount >= link.maxDownloads;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold mb-10">
        <Cloud className="size-6 text-[var(--accent)]" />
        MyCloud
      </Link>

      <div className="w-full max-w-md">
        {expired || maxReached ? (
          <div className="tile cursor-default text-center !p-10">
            <FileX className="size-12 text-[var(--danger)] mx-auto mb-4" />
            <h1 className="text-xl font-bold">
              {expired ? "Ce lien a expiré" : "Limite de téléchargements atteinte"}
            </h1>
            <p className="text-sm text-[var(--foreground-muted)] mt-2">
              Demande à l&apos;expéditeur d&apos;en générer un nouveau.
            </p>
          </div>
        ) : (
          <div className="tile cursor-default !p-8">
            <div className="flex flex-col items-center text-center">
              <div className="tile-icon !size-20 !rounded-2xl mb-4">
                <FileIcon mimeType={link.file?.mimeType ?? "application/octet-stream"} className="size-10" />
              </div>
              <h1 className="text-2xl font-bold truncate max-w-full" title={link.file?.name}>
                {link.file?.name ?? "Fichier"}
              </h1>
              <p className="text-sm text-[var(--foreground-muted)] mt-1">
                {link.file ? formatBytes(Number(link.file.size)) : ""}
              </p>
            </div>

            {link.customMessage && (
              <div className="mt-6 rounded-xl bg-[var(--background-elevated)] p-4 text-sm italic text-[var(--foreground-muted)] border border-[var(--border)]">
                « {link.customMessage} »
              </div>
            )}

            <div className="mt-6 space-y-2 text-xs text-[var(--foreground-muted)]">
              {link.expiresAt && (
                <p className="flex items-center gap-2">
                  <Clock className="size-3.5" />
                  Expire le {new Date(link.expiresAt).toLocaleDateString(locale)}{" "}
                  à {new Date(link.expiresAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              {link.maxDownloads != null && (
                <p className="flex items-center gap-2">
                  <Download className="size-3.5" />
                  {link.downloadCount} / {link.maxDownloads} téléchargements
                </p>
              )}
              {link.passwordHash && (
                <p className="flex items-center gap-2">
                  <Lock className="size-3.5" />
                  Protégé par mot de passe
                </p>
              )}
            </div>

            <PublicDownloadForm token={token} requiresPassword={!!link.passwordHash} />
          </div>
        )}

        <p className="text-center text-xs text-[var(--foreground-muted)] mt-6">
          Partagé via{" "}
          <Link href="/" className="text-[var(--accent)] hover:underline">
            MyCloud
          </Link>
        </p>
      </div>
    </main>
  );
}
