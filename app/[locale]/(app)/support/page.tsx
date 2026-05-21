import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { TicketsClientPanel } from "@/components/tickets-client-panel";
import { BackLink } from "@/components/back-link";
import { PageHero } from "@/components/page-hero";
import { LifeBuoy, MessageCircle } from "lucide-react";

export default async function SupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const tickets = await db.ticket.findMany({
    where: { openedById: session.id },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: { _count: { select: { messages: true } } },
  });

  const whatsappNumber = process.env.WHATSAPP_BUSINESS_NUMBER ?? null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 space-y-6">
        <BackLink />
        <PageHero
          icon={LifeBuoy}
          variant="pink"
          title="Support"
          description={
            <>
              Notre équipe te répond généralement sous 24h. Pour les urgences, prends contact via WhatsApp.
              {tickets.length > 0 && ` ${tickets.length} ticket(s) en cours.`}
            </>
          }
        />

        {/* Contact rapide */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="tile cursor-default !min-h-0">
            <div className="tile-icon">
              <LifeBuoy className="size-5" />
            </div>
            <div className="mt-2">
              <h2 className="font-semibold">Tickets</h2>
              <p className="text-sm text-[var(--foreground-muted)]">
                Réponse écrite, garde une trace de la conversation.
              </p>
            </div>
          </div>
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, "")}?text=Bonjour,%20je%20suis%20${encodeURIComponent(session.name)}%20et%20j'ai%20une%20question%20sur%20mon%20compte%20MyTitanCloud.`}
              target="_blank"
              rel="noopener noreferrer"
              className="tile group cursor-pointer"
            >
              <div className="tile-icon !text-emerald-400">
                <MessageCircle className="size-5" />
              </div>
              <div className="mt-2">
                <h2 className="font-semibold">WhatsApp</h2>
                <p className="text-sm text-[var(--foreground-muted)]">Réponse rapide pour les urgences.</p>
              </div>
            </a>
          )}
        </div>

        <TicketsClientPanel
          locale={locale}
          tickets={tickets.map((t) => ({
            id: t.id,
            number: t.number,
            subject: t.subject,
            status: t.status,
            priority: t.priority,
            updatedAt: t.updatedAt.toISOString(),
            messagesCount: t._count.messages,
          }))}
        />
      </main>
    </>
  );
}
