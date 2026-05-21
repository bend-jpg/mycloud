import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { BoxTile } from "@/components/box-tile";
import { SiteHeader } from "@/components/site-header";
import { FileIcon } from "@/components/file-icon";
import { WelcomeModal } from "@/components/welcome-modal";
import { StorageDonut, UploadsBarChart } from "@/components/stats-charts";
import { getUserStorageStats } from "@/lib/storage-stats";
import { formatBytes } from "@/lib/utils";
import {
  FolderOpen,
  Users,
  Share2,
  CreditCard,
  Settings,
  Shield,
  UserCog,
  LifeBuoy,
  Clock,
} from "lucide-react";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const [user, recentFiles, stats] = await Promise.all([
    db.user.findUnique({
      where: { id: session.id },
      select: { name: true, storageUsed: true, storageQuota: true },
    }),
    db.file.findMany({
      where: { ownerId: session.id, isTrash: false, teamId: null },
      orderBy: { uploadedAt: "desc" },
      take: 6,
      select: { id: true, name: true, mimeType: true, size: true, uploadedAt: true },
    }),
    getUserStorageStats(session.id),
  ]);

  const used = Number(user?.storageUsed ?? BigInt(0));
  const total = Number(user?.storageQuota ?? BigInt(1));
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return (
    <>
      <SiteHeader />
      <WelcomeModal userName={user?.name ?? session.name} />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">
              {t("welcome", { name: user?.name ?? session.name })}
            </h1>
            <p className="text-[var(--foreground-muted)] mt-1">
              {t("usage", { used: formatBytes(used), total: formatBytes(total) })}
            </p>
          </div>
          <div className="w-full md:w-80">
            <div className="h-2 rounded-full bg-[var(--background-elevated)] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--secondary)] rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-[var(--foreground-muted)] mt-2 text-end">{pct}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <BoxTile
            href="/files"
            icon={<FolderOpen className="size-6" />}
            title={t("tiles.files.title")}
            description={t("tiles.files.desc")}
            accent="cyan"
          />
          <BoxTile
            href="/family"
            icon={<Users className="size-6" />}
            title={t("tiles.family.title")}
            description={t("tiles.family.desc")}
            accent="amber"
          />
          <BoxTile
            href="/accounts"
            icon={<UserCog className="size-6" />}
            title="Sous-comptes"
            description="Crée des accès pour ta famille avec un quota dédié"
            accent="cyan"
          />
          <BoxTile
            href="/shares"
            icon={<Share2 className="size-6" />}
            title={t("tiles.shares.title")}
            description={t("tiles.shares.desc")}
            accent="violet"
          />
          <BoxTile
            href="/billing"
            icon={<CreditCard className="size-6" />}
            title={t("tiles.billing.title")}
            description={t("tiles.billing.desc")}
            accent="green"
          />
          <BoxTile
            href="/support"
            icon={<LifeBuoy className="size-6" />}
            title="Support"
            description="Tickets et WhatsApp avec notre équipe"
          />
          <BoxTile
            href="/settings"
            icon={<Settings className="size-6" />}
            title={t("tiles.settings.title")}
            description={t("tiles.settings.desc")}
          />
          {session.isAdmin && (
            <BoxTile
              href="/admin"
              icon={<Shield className="size-6" />}
              title={t("tiles.admin.title")}
              description={t("tiles.admin.desc")}
              badge="Admin"
              accent="amber"
            />
          )}
        </div>

        {/* Stats : donut + bar chart côte à côte */}
        {stats.totalFiles > 0 && (
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <StorageDonut categories={stats.categories} totalBytes={stats.totalBytes} />
            <UploadsBarChart months={stats.months} />
          </div>
        )}

        {/* Récemment uploadés */}
        {recentFiles.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Clock className="size-5 text-[var(--accent)]" />
                Récemment uploadés
              </h2>
              <Link href="/files" className="text-sm text-[var(--accent)] hover:underline">
                Voir tous mes fichiers →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {recentFiles.map((f) => {
                const isImage = f.mimeType.startsWith("image/");
                return (
                  <Link
                    key={f.id}
                    href={`/files`}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-hidden hover:scale-[1.02] transition-transform"
                  >
                    <div className="h-24 bg-[var(--background-elevated)] flex items-center justify-center overflow-hidden">
                      {isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/files/${f.id}/preview`}
                          alt={f.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileIcon mimeType={f.mimeType} className="size-10" />
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium truncate" title={f.name}>{f.name}</p>
                      <p className="text-[10px] text-[var(--foreground-muted)]">
                        {formatBytes(Number(f.size))}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
