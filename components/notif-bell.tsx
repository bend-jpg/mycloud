// Petite cloche dans le header : montre le compteur de notifications non lues.
// On charge le compteur depuis l'API au mount.

import { db } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import { Bell } from "lucide-react";

export async function NotifBell({ userId }: { userId: string }) {
  const unreadCount = await db.notification.count({
    where: { userId, read: false },
  });

  return (
    <Link
      href="/notifications"
      className="relative size-9 rounded-full bg-[var(--background-elevated)] border border-[var(--border)] flex items-center justify-center hover:border-[var(--border-hover)] transition-colors"
      title="Notifications"
    >
      <Bell className="size-4" />
      {unreadCount > 0 && (
        <span
          className="absolute -top-1 -end-1 min-w-5 h-5 px-1 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-[10px] font-semibold flex items-center justify-center shadow"
          aria-label={`${unreadCount} non lues`}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
