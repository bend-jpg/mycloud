"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X, Check, ExternalLink } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items);
      setUnread(data.unreadCount);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "POST" });
    load();
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    load();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl hover:bg-[var(--background-tile)] transition-colors"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1 end-1 size-5 rounded-full bg-[var(--danger)] text-white text-xs font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 mt-2 w-80 max-w-[90vw] rounded-2xl border border-[var(--border)] bg-[var(--background-elevated)] shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
            <span className="font-semibold text-sm">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-[var(--accent)] hover:underline">
                Tout marquer lu
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--foreground-muted)]">
              Aucune notification
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-[var(--border)]">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`p-3 hover:bg-[var(--background-tile)] transition-colors ${
                    !n.read ? "bg-[var(--accent)]/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-2">
                        {!n.read && <span className="size-2 rounded-full bg-[var(--accent)] shrink-0" />}
                        {n.title}
                      </p>
                      {n.body && <p className="text-xs text-[var(--foreground-muted)] mt-0.5">{n.body}</p>}
                      <p className="text-xs text-[var(--foreground-muted)] mt-1">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {n.link && (
                        <Link
                          href={n.link}
                          onClick={() => {
                            markRead(n.id);
                            setOpen(false);
                          }}
                          className="p-1 rounded-lg text-[var(--accent)] hover:bg-[var(--background-elevated)]"
                          title="Ouvrir"
                        >
                          <ExternalLink className="size-3.5" />
                        </Link>
                      )}
                      {!n.read && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="p-1 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-elevated)]"
                          title="Marquer lu"
                        >
                          <Check className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
