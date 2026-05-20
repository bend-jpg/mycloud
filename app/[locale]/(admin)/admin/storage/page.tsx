import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/utils";
import { HardDrive, Star, Trash2 } from "lucide-react";
import { AddStorageButton } from "@/components/admin-add-storage-button";

export default async function AdminStoragePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const backends = await db.storageBackend.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: { _count: { select: { files: true } } },
  });

  return (
    <main className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stockage</h1>
          <p className="text-[var(--foreground-muted)] mt-1">
            Les backends où sont stockés les fichiers de tous les clients.
          </p>
        </div>
        <AddStorageButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {backends.map((b) => (
          <div key={b.id} className="tile cursor-default !min-h-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="tile-icon">
                  <HardDrive className="size-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    {b.name}
                    {b.isDefault && (
                      <span className="inline-flex items-center gap-1 text-xs rounded-full bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-0.5">
                        <Star className="size-3" /> Défaut
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    {b.type} · bucket : <code>{b.bucket}</code>
                  </p>
                </div>
              </div>
              <span
                className={`text-xs rounded-full px-2 py-1 ${
                  b.isActive ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--danger)]/10 text-[var(--danger)]"
                }`}
              >
                {b.isActive ? "Actif" : "Inactif"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div>
                <p className="text-xs text-[var(--foreground-muted)]">Fichiers</p>
                <p className="font-semibold">{b._count.files}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--foreground-muted)]">Utilisé</p>
                <p className="font-semibold">{formatBytes(b.usedBytes)}</p>
              </div>
            </div>
            {b.endpoint && (
              <p className="text-xs text-[var(--foreground-muted)] mt-3 font-mono truncate" title={b.endpoint}>
                Endpoint : {b.endpoint}
              </p>
            )}
            {b.publicUrl && (
              <p className="text-xs text-[var(--foreground-muted)] mt-1 font-mono truncate">
                CDN : {b.publicUrl}
              </p>
            )}
          </div>
        ))}
      </div>

      {backends.length === 0 && (
        <div className="text-center text-[var(--foreground-muted)] py-12">
          Aucun backend configuré. Ajoute-en un.
        </div>
      )}
    </main>
  );
}
