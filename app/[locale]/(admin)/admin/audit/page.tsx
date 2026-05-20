import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";

export default async function AdminAuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const logs = await db.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { actor: { select: { email: true, name: true } } },
  });

  return (
    <main className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Journal d&apos;audit</h1>
        <p className="text-[var(--foreground-muted)] mt-1">
          Toutes les actions admin sont tracées. 300 dernières entrées.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--background-elevated)] text-[var(--foreground-muted)] text-xs uppercase">
            <tr>
              <th className="text-start px-4 py-3">Date</th>
              <th className="text-start px-4 py-3">Acteur</th>
              <th className="text-start px-4 py-3">Action</th>
              <th className="text-start px-4 py-3">Cible</th>
              <th className="text-start px-4 py-3">Détails</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 text-xs">{new Date(l.createdAt).toLocaleString(locale)}</td>
                <td className="px-4 py-3 text-xs">{l.actor.name ?? l.actor.email}</td>
                <td className="px-4 py-3">
                  <code className="text-xs rounded bg-[var(--background-elevated)] px-2 py-0.5">{l.action}</code>
                </td>
                <td className="px-4 py-3 text-xs">
                  {l.targetType} {l.targetId && <code className="opacity-60">{l.targetId.slice(0, 8)}</code>}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--foreground-muted)] max-w-md truncate">
                  {l.metadata ? JSON.stringify(l.metadata) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && (
          <p className="text-center text-sm text-[var(--foreground-muted)] py-12">Aucune action enregistrée.</p>
        )}
      </div>
    </main>
  );
}
