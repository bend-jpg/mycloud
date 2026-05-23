import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { Ticket as TicketIcon, Search, Filter, LifeBuoy } from "lucide-react";
import { AdminTicketRow } from "@/components/admin-ticket-row";
import { PageHero } from "@/components/page-hero";

export default async function AdminTicketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string; priority?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, status, priority } = await searchParams;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (q) {
    where.OR = [
      { subject: { contains: q, mode: "insensitive" } },
      { openedBy: { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } },
    ];
  }

  const tickets = await db.ticket.findMany({
    where,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      openedBy: { select: { id: true, email: true, name: true } },
      _count: { select: { messages: true } },
    },
    take: 200,
  });

  return (
    <main className="p-4 sm:p-8 space-y-6">
      <PageHero
        icon={LifeBuoy}
        variant="pink"
        title="Support"
        description={`${tickets.length} ticket(s). Clique sur une ligne pour répondre.`}
      />

      <form className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-60">
          <Search className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)]" />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Sujet, email, nom client…"
            className="w-full rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] ps-10 pe-4 py-2 text-sm"
          />
        </div>
        <select name="status" defaultValue={status ?? ""} className="rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] px-3 py-2 text-sm">
          <option value="">Tous statuts</option>
          <option value="OPEN">Ouvert</option>
          <option value="IN_PROGRESS">En cours</option>
          <option value="WAITING_USER">Attente client</option>
          <option value="RESOLVED">Résolu</option>
          <option value="CLOSED">Fermé</option>
        </select>
        <select name="priority" defaultValue={priority ?? ""} className="rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] px-3 py-2 text-sm">
          <option value="">Toutes priorités</option>
          <option value="LOW">Basse</option>
          <option value="NORMAL">Normale</option>
          <option value="HIGH">Haute</option>
          <option value="URGENT">Urgente</option>
        </select>
        <button type="submit" className="btn-primary text-sm"><Filter className="size-4" /> Filtrer</button>
      </form>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-x-auto">
        {tickets.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-[var(--background-elevated)] text-[var(--foreground-muted)] mb-3">
              <TicketIcon className="size-7" />
            </div>
            <p className="text-base font-medium">Aucun ticket</p>
            <p className="text-sm text-[var(--foreground-muted)] mt-1 max-w-md mx-auto">
              {q || status || priority
                ? "Essaie de modifier tes filtres pour voir plus de résultats."
                : "Les tickets ouverts par tes clients apparaîtront ici. Pour envoyer toi-même un message, va sur la fiche d'un client → Message client."}
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
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {tickets.map((t) => (
                <AdminTicketRow
                  key={t.id}
                  ticket={{
                    id: t.id,
                    number: t.number,
                    subject: t.subject,
                    status: t.status,
                    priority: t.priority,
                    updatedAt: t.updatedAt.toISOString(),
                    openedBy: { id: t.openedBy.id, name: t.openedBy.name, email: t.openedBy.email },
                    messagesCount: t._count.messages,
                  }}
                  locale={locale}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
