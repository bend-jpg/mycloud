import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { Shield } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Super-admin",
  STAFF_SUPPORT: "Support",
  STAFF_BILLING: "Comptable",
  STAFF_OPS: "Ops",
};

const ROLE_COLOR: Record<string, string> = {
  ADMIN: "bg-[var(--accent)]/15 text-[var(--accent)]",
  STAFF_SUPPORT: "bg-blue-500/15 text-blue-400",
  STAFF_BILLING: "bg-emerald-500/15 text-emerald-400",
  STAFF_OPS: "bg-violet-500/15 text-violet-400",
};

export default async function AdminStaffPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const staff = await db.user.findMany({
    where: { role: { not: "USER" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      lastLoginAt: true,
      suspendedAt: true,
      twoFactorEnabled: true,
    },
  });

  return (
    <main className="p-4 sm:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Shield className="size-7 text-[var(--accent)]" />
            Équipe interne
          </h1>
          <p className="text-[var(--foreground-muted)] mt-1 text-sm">
            Membres de ton équipe avec accès au back-office. Clique sur un membre pour gérer son rôle.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--background-elevated)] text-[var(--foreground-muted)] text-xs uppercase">
            <tr>
              <th className="text-start px-4 py-3">Membre</th>
              <th className="text-start px-4 py-3">Rôle</th>
              <th className="text-start px-4 py-3 hidden sm:table-cell">2FA</th>
              <th className="text-start px-4 py-3 hidden md:table-cell">Statut</th>
              <th className="text-start px-4 py-3 hidden md:table-cell">Dernière connexion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {staff.map((u) => (
              <tr key={u.id} className="hover:bg-[var(--background-elevated)]">
                <td className="px-4 py-3">
                  <Link href={`/admin/staff/${u.id}`} className="flex items-center gap-3 hover:text-[var(--accent)]">
                    <div className="size-9 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-xs font-semibold">
                      {(u.name ?? u.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{u.name ?? "—"}</p>
                      <p className="text-xs text-[var(--foreground-muted)]">{u.email}</p>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs rounded-full px-2 py-1 ${ROLE_COLOR[u.role] ?? "bg-[var(--background-elevated)]"}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-xs">
                  {u.twoFactorEnabled ? (
                    <span className="text-[var(--success)]">✓ Activée</span>
                  ) : (
                    <span className="text-yellow-400">Désactivée</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-xs">
                  {u.suspendedAt ? (
                    <span className="text-[var(--danger)]">Suspendu</span>
                  ) : (
                    <span className="text-[var(--success)]">Actif</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-[var(--foreground-muted)]">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString(locale) : "Jamais"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {staff.length === 0 && (
          <div className="text-center py-12 text-sm text-[var(--foreground-muted)]">
            <Shield className="size-10 mx-auto mb-2 opacity-30" />
            Aucun membre interne. Promeus un utilisateur existant depuis sa fiche client
            (Profil → Rôle = ADMIN / STAFF_SUPPORT…).
          </div>
        )}
      </div>

      <div className="rounded-xl bg-[var(--background-elevated)] p-4 text-sm text-[var(--foreground-muted)]">
        <p className="font-medium text-[var(--foreground)] mb-1">Comment ajouter un membre ?</p>
        <p>
          1. Demande au futur staff de créer un compte normal sur le site.<br />
          2. Va sur sa{" "}
          <Link href="/admin/clients" className="text-[var(--accent)] underline">
            fiche client
          </Link>
          .<br />
          3. Onglet « Sécurité » → bouton « Promouvoir en admin » (ou modifie le rôle via l&apos;API).<br />
          4. Il apparaîtra ensuite dans cette page.
        </p>
      </div>
    </main>
  );
}
