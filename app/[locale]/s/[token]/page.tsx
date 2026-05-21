import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { FileIcon } from "@/components/file-icon";
import { FileThumbnail } from "@/components/file-thumbnail";
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
    include: {
      file: { select: { id: true, name: true, size: true, mimeType: true } },
      createdBy: {
        select: {
          name: true,
          email: true,
          brandLogoUrl: true,
          brandColor: true,
          brandSenderName: true,
        },
      },
    },
  });

  if (!link || link.revokedAt) notFound();

  const expired = link.expiresAt && link.expiresAt < new Date();
  const maxReached = link.maxDownloads != null && link.downloadCount >= link.maxDownloads;

  // Branding : valeurs de l'expéditeur ou défauts MyTitanCloud
  const brand = link.createdBy;
  const senderName = brand?.brandSenderName?.trim() || brand?.name || brand?.email || "Quelqu'un";
  const accentColor = brand?.brandColor?.trim() || null;
  const logoUrl = brand?.brandLogoUrl?.trim() || null;
  const isImage = link.file?.mimeType?.startsWith("image/") ?? false;

  // Inline style pour appliquer la couleur custom comme variable CSS scopée
  const accentStyle = accentColor
    ? ({ "--share-accent": accentColor } as React.CSSProperties)
    : undefined;

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden"
      style={accentStyle}
    >
      {/* Décor : gradient blob coloré (accent custom ou défaut) */}
      <div
        className="pointer-events-none absolute -top-32 -end-32 size-96 rounded-full blur-3xl opacity-30"
        style={{ background: accentColor ?? "var(--accent)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -start-32 size-96 rounded-full blur-3xl opacity-20"
        style={{ background: accentColor ?? "var(--secondary)" }}
      />

      {/* Logo en haut : custom de l'expéditeur OU défaut MyTitanCloud */}
      <div className="relative flex items-center gap-2 text-lg font-semibold mb-10">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-8 w-auto max-w-[180px] object-contain" />
        ) : (
          <Link href="/" className="flex items-center gap-2">
            <Cloud className="size-6" style={{ color: accentColor ?? "var(--accent)" }} />
            MyTitanCloud
          </Link>
        )}
      </div>

      <div className="relative w-full max-w-md">
        {expired || maxReached ? (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--background-tile)] p-10 text-center">
            <FileX className="size-12 text-[var(--danger)] mx-auto mb-4" />
            <h1 className="text-xl font-bold">
              {expired ? "Ce lien a expiré" : "Limite de téléchargements atteinte"}
            </h1>
            <p className="text-sm text-[var(--foreground-muted)] mt-2">
              Demande à l&apos;expéditeur d&apos;en générer un nouveau.
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--background-tile)] p-8 shadow-2xl">
            {/* Sender pill en haut */}
            <p className="text-xs text-center text-[var(--foreground-muted)] mb-4">
              <strong style={{ color: accentColor ?? "var(--accent)" }}>{senderName}</strong> t&apos;a partagé un fichier
            </p>

            <div className="flex flex-col items-center text-center">
              {/* Preview image en grand si c'est une image */}
              {isImage && link.file ? (
                <div className="w-full max-h-64 rounded-2xl bg-[var(--background-elevated)] overflow-hidden mb-4 border border-[var(--border)]">
                  <FileThumbnail
                    fileId={link.file.id}
                    mimeType={link.file.mimeType}
                    alt={link.file.name}
                    className="w-full h-64"
                    iconClassName="size-16"
                  />
                </div>
              ) : (
                <div
                  className="size-20 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                  style={{
                    background: accentColor ? `${accentColor}25` : "var(--background-elevated)",
                    border: `1px solid ${accentColor ?? "var(--border)"}40`,
                  }}
                >
                  <FileIcon
                    mimeType={link.file?.mimeType ?? "application/octet-stream"}
                    className="size-10"
                  />
                </div>
              )}
              <h1 className="text-2xl font-bold truncate max-w-full" title={link.file?.name}>
                {link.file?.name ?? "Fichier"}
              </h1>
              <p className="text-sm text-[var(--foreground-muted)] mt-1">
                {link.file ? formatBytes(Number(link.file.size)) : ""}
              </p>
            </div>

            {link.customMessage && (
              <div
                className="mt-6 rounded-xl bg-[var(--background-elevated)] p-4 text-sm italic text-[var(--foreground-muted)] border-l-4"
                style={{ borderLeftColor: accentColor ?? "var(--accent)" }}
              >
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

            <PublicDownloadForm
              token={token}
              requiresPassword={!!link.passwordHash}
              accentColor={accentColor}
            />
          </div>
        )}

        <p className="text-center text-xs text-[var(--foreground-muted)] mt-6">
          Partagé via{" "}
          <Link href="/" className="hover:underline" style={{ color: accentColor ?? "var(--accent)" }}>
            MyTitanCloud
          </Link>
        </p>
      </div>
    </main>
  );
}
