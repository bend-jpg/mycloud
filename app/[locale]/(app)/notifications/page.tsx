import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { NotificationsView } from "@/components/notifications-view";
import { Bell } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const items = await db.notification.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Bell className="size-7 text-[var(--accent)]" />
              Notifications
              {unreadCount > 0 && (
                <span className="text-xs rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] px-2 py-0.5">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">
              {items.length} notification(s) — 100 dernières conservées.
            </p>
          </div>
        </div>

        <NotificationsView
          items={items.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            link: n.link,
            read: n.read,
            createdAt: n.createdAt.toISOString(),
          }))}
        />
      </main>
    </>
  );
}
