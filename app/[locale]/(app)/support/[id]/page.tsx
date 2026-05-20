import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { TicketThread } from "@/components/ticket-thread";
import { ChevronLeft } from "lucide-react";

export default async function SupportTicketPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      openedBy: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true, role: true } } },
      },
    },
  });
  if (!ticket) notFound();
  if (ticket.openedById !== session.id && !session.isAdmin) notFound();

  const visibleMessages = session.isAdmin ? ticket.messages : ticket.messages.filter((m) => !m.isInternal);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-6">
        <Link
          href="/support"
          className="flex items-center gap-1 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" /> Mes tickets
        </Link>
        <TicketThread
          isAdminView={false}
          currentUserId={session.id}
          ticket={{
            id: ticket.id,
            number: ticket.number,
            subject: ticket.subject,
            status: ticket.status,
            priority: ticket.priority,
            openedBy: ticket.openedBy,
            messages: visibleMessages.map((m) => ({
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
    </>
  );
}
