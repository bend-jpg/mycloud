// Fiche d'un membre de l'équipe interne (staff).
// Contrairement à la fiche client, pas de plan, pas de paiements, pas de subscription :
// le staff est un compte interne avec un rôle (ADMIN / STAFF_SUPPORT / STAFF_BILLING / STAFF_OPS).

import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { ChevronLeft, Mail, Phone, Calendar, Shield } from "lucide-react";
import { AdminStaffEditPanel } from "@/components/admin-staff-edit-panel";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Super-admin",
  STAFF_SUPPORT: "Support client",
  STAFF_BILLING: "Comptable",
  STAFF_OPS: "Opérations / DevOps",
};

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      whatsapp: true,
      role: true,
      locale: true,
      createdAt: true,
      lastLoginAt: true,
      suspendedAt: true,
      twoFactorEnabled: true,
    },
  });
  if (!user) notFound();

  // Si ce n'est pas un staff, rediriger vers la fiche client classique
  if (user.role === "USER") {
    notFound();
  }

  // Dernières actions admin de ce staff (utile pour le suivi)
  const lastActions = await db.adminAuditLog.findMany({
    where: { actorId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, action: true, targetType: true, targetId: true, createdAt: true },
  });

  return (
    <main className="p-4 sm:p-8 space-y-6">
      <Link
        href="/admin/staff"
        className="flex items-center gap-1 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" />
        Toute l&apos;équipe
      </Link>

      {/* Header staff */}
      <div className="tile cursor-default !min-h-0">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="size-16 rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center text-2xl font-semibold">
            {(user.name ?? user.email).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
              {user.name ?? "—"}
              <span className="text-xs rounded-full bg-[var(--accent)]/15 text-[var(--accent)] px-2 py-0.5 flex items-center gap-1">
                <Shield className="size-3" />
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
              {user.suspendedAt && (
                <span className="text-xs rounded-full bg-[var(--danger)]/10 text-[var(--danger)] px-2 py-0.5">
                  Suspendu
                </span>
              )}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-[var(--foreground-muted)]">
              <span className="flex items-center gap-1.5"><Mail className="size-3.5" /> {user.email}</span>
              {user.phone && <span className="flex items-center gap-1.5"><Phone className="size-3.5" /> {user.phone}</span>}
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5" /> Ajouté le {new Date(user.createdAt).toLocaleDateString(locale)}
              </span>
              {user.lastLoginAt && (
                <span className="flex items-center gap-1.5">
                  Dernière connexion : {new Date(user.lastLoginAt).toLocaleString(locale)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="rounded-xl bg-[var(--background-elevated)] p-3">
            <p className="text-xs text-[var(--foreground-muted)]">Rôle</p>
            <p className="text-lg font-bold">{ROLE_LABELS[user.role] ?? user.role}</p>
          </div>
          <div className="rounded-xl bg-[var(--background-elevated)] p-3">
            <p className="text-xs text-[var(--foreground-muted)]">2FA</p>
            <p className="text-lg font-bold">
              {user.twoFactorEnabled ? (
                <span className="text-[var(--success)]">Activée</span>
              ) : (
                <span className="text-yellow-400">Désactivée</span>
              )}
            </p>
          </div>
          <div className="rounded-xl bg-[var(--background-elevated)] p-3">
            <p className="text-xs text-[var(--foreground-muted)]">Statut</p>
            <p className="text-lg font-bold">
              {user.suspendedAt ? (
                <span className="text-[var(--danger)]">Suspendu</span>
              ) : (
                <span className="text-[var(--success)]">Actif</span>
              )}
            </p>
          </div>
          <div className="rounded-xl bg-[var(--background-elevated)] p-3">
            <p className="text-xs text-[var(--foreground-muted)]">Langue</p>
            <p className="text-lg font-bold uppercase">{user.locale}</p>
          </div>
        </div>
      </div>

      {/* Panneau édition (réutilisable) */}
      <AdminStaffEditPanel
        userId={user.id}
        initial={{
          name: user.name ?? "",
          email: user.email,
          phone: user.phone ?? "",
          whatsapp: user.whatsapp ?? "",
          locale: user.locale,
          role: user.role,
          isSuspended: !!user.suspendedAt,
        }}
      />

      {/* Dernières actions */}
      <div className="tile cursor-default !min-h-0">
        <h2 className="font-semibold mb-3">Dernières actions ({lastActions.length})</h2>
        {lastActions.length === 0 ? (
          <p className="text-sm text-[var(--foreground-muted)]">
            Aucune action enregistrée. Les actions admin de ce membre apparaîtront ici.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {lastActions.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="font-mono text-xs">{a.action}</p>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    {a.targetType ?? "—"} {a.targetId ? `${a.targetId.slice(0, 8)}…` : ""}
                  </p>
                </div>
                <span className="text-xs text-[var(--foreground-muted)]">
                  {new Date(a.createdAt).toLocaleString(locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/audit" className="inline-block mt-3 text-xs text-[var(--accent)] hover:underline">
          Voir tout l&apos;historique →
        </Link>
      </div>
    </main>
  );
}
