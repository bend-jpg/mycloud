import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { Ticket as TicketIcon } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "text-yellow-400 bg-yellow-400/10",
  IN_PROGRESS: "text-[var(--accent)] bg-[var(--accent)]/10",
  WAITING_USER: "text-violet-400 bg-violet-400/10",
  RESOLVED: "text-[var(--success)] bg-[var(--success)]/10",
  CLOSED: "text-[var(--foreground-muted)] bg-[var(--background-elevated)]",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "text-[var(--foreground-muted)]",
  NORMAL: "text-[var(--foreground)]",
  HIGH: "text-yellow-400",
  URGENT: "text-[var(--danger)]",
};

export default async function AdminTicketsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tickets = await db.ticket.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      openedBy: { select: { id: true, email: true, name: true } },
      _count: { select: { messages: true } },
    },
    take: 100,
  });

  return (
    <main className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Support</h1>
        <p className="text-[var(--foreground-muted)] mt-1">
          Tickets de tes clients. (Création de tickets côté client : Phase 4.5)
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-hidden">
        {tickets.length === 0 ? (
          <div className="text-center py-16 text-[var(--foreground-muted)]">
            <TicketIcon className="size-12 mx-auto mb-3 opacity-30" />
            <p>Aucun ticket pour l&apos;instant.</p>
            <p className="text-xs mt-2">
              Le système de tickets côté client (UI utilisateur) sera livré dans la prochaine itération.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--background-elevated)] text-[var(--foreground-muted)] text-xs uppercase">
              <tr>
                <th className="text-start px-4 py-3">#</th>
                <th className="text-start px-4 py-3">Sujet</th>
                <th className="text-start px-4 py-3">Client</th>
                <th className="text-start px-4 py-3">Priorité</th>
                <th className="text-start px-4 py-3">Statut</th>
                <th className="text-end px-4 py-3">MAJ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-[var(--background-elevated)]">
                  <td className="px-4 py-3 font-mono text-xs">#{t.number}</td>
                  <td className="px-4 py-3 font-medium">{t.subject}</td>
                  <td className="px-4 py-3 text-xs">
                    <Link href={`/admin/clients/${t.openedBy.id}`} className="hover:text-[var(--accent)]">
                      {t.openedBy.name ?? t.openedBy.email}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={PRIORITY_COLORS[t.priority]}>{t.priority}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs rounded-full px-2 py-1 ${STATUS_COLORS[t.status]}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end text-xs text-[var(--foreground-muted)]">
                    {new Date(t.updatedAt).toLocaleDateString(locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
