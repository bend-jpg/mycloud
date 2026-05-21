import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/utils";
import { HardDrive } from "lucide-react";
import { StorageEditorButton } from "@/components/admin-storage-editor";
import { AdminStorageRow } from "@/components/admin-storage-row";
import { globalCostStats } from "@/lib/cost-stats";

export default async function AdminStoragePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [backends, costStats] = await Promise.all([
    db.storageBackend.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: { _count: { select: { files: true } } },
    }),
    globalCostStats(),
  ]);

  const totalUsed = backends.reduce((sum, b) => sum + Number(b.usedBytes), 0);
  const totalFiles = backends.reduce((sum, b) => sum + b._count.files, 0);
  const activeCount = backends.filter((b) => b.isActive).length;

  return (
    <main className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Stockage</h1>
          <p className="text-[var(--foreground-muted)] mt-1">
            {backends.length} backend(s) · {activeCount} actif(s) · {formatBytes(totalUsed)} utilisés ·{" "}
            {totalFiles} fichier(s)
          </p>
        </div>
        <StorageEditorButton />
      </div>

      {/* Résumé coût */}
      {costStats.perBackend.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-4">
          <p className="text-sm text-[var(--foreground-muted)] mb-2">Coût mensuel estimé du stockage</p>
          <p className="text-3xl font-bold text-[var(--danger)]">
            {costStats.totalCostMonthlyEur.toFixed(2)} €
          </p>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            Total tous backends confondus. Marge actuelle :{" "}
            <strong
              className={
                costStats.totalMarginMonthlyEur >= 0
                  ? "text-[var(--success)]"
                  : "text-[var(--danger)]"
              }
            >
              {costStats.totalMarginMonthlyEur.toFixed(2)} €
            </strong>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {backends.map((b) => (
          <AdminStorageRow
            key={b.id}
            backend={{
              id: b.id,
              name: b.name,
              type: b.type,
              endpoint: b.endpoint,
              region: b.region,
              bucket: b.bucket,
              publicUrl: b.publicUrl,
              isDefault: b.isDefault,
              isActive: b.isActive,
              usedBytes: b.usedBytes.toString(),
              filesCount: b._count.files,
            }}
          />
        ))}
      </div>

      {backends.length === 0 && (
        <div className="text-center text-[var(--foreground-muted)] py-16">
          <HardDrive className="size-12 mx-auto mb-3 opacity-30" />
          <p>Aucun backend configuré. Ajoute-en un (R2, B2, S3, MinIO, Wasabi…).</p>
        </div>
      )}
    </main>
  );
}
