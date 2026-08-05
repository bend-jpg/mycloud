import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { TicketThread } from "@/components/ticket-thread";
import { ChevronLeft, User } from "lucide-react";
import { redirect } from "next/navigation";
import { guardAdminPage } from "@/lib/admin-guard";

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // Autorisation AVANT toute requête. Le garde du layout ne protège pas :
  // Next rend layout et page en parallèle, donc sans ce contrôle la page
  // interroge la base et ses données partent dans la réponse malgré la
  // redirection. Vérifié en production sur /admin/storage.
  await guardAdminPage("page.tickets", locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      openedBy: { select: { id: true, name: true, email: true, plan: { select: { name: true } } } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true, role: true } } },
      },
    },
  });
  if (!ticket) notFound();

  return (
    <main className="p-4 sm:p-8 space-y-6 max-w-4xl">
      <Link
        href="/admin/tickets"
        className="flex items-center gap-1 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" /> Tous les tickets
      </Link>

      <Link
        href={`/admin/clients/${ticket.openedBy.id}`}
        className="flex items-center gap-2 text-sm text-[var(--accent)] hover:underline"
      >
        <User className="size-4" />
        Voir la fiche client de {ticket.openedBy.name ?? ticket.openedBy.email}
        {ticket.openedBy.plan && ` (plan ${ticket.openedBy.plan.name})`}
      </Link>

      <TicketThread
        isAdminView={true}
        currentUserId={session.id}
        ticket={{
          id: ticket.id,
          number: ticket.number,
          subject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          openedBy: {
            id: ticket.openedBy.id,
            name: ticket.openedBy.name,
            email: ticket.openedBy.email,
          },
          messages: ticket.messages.map((m) => ({
            id: m.id,
            body: m.body,
            isInternal: m.isInternal,
            createdAt: m.createdAt.toISOString(),
            author: {
              id: m.author.id,
              name: m.author.name,
              email: m.author.email,
              role: m.author.role,
            },
          })),
        }}
      />
    </main>
  );
}
