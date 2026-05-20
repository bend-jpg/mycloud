import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Super-admin",
  STAFF_SUPPORT: "Support",
  STAFF_BILLING: "Comptable",
  STAFF_OPS: "Ops",
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
  });

  return (
    <main className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Équipe interne</h1>
        <p className="text-[var(--foreground-muted)] mt-1">
          Membres de ton équipe avec accès admin. Modifie les rôles depuis la fiche client.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--background-elevated)] text-[var(--foreground-muted)] text-xs uppercase">
            <tr>
              <th className="text-start px-4 py-3">Membre</th>
              <th className="text-start px-4 py-3">Rôle</th>
              <th className="text-start px-4 py-3">Dernière connexion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {staff.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <Link href={`/admin/clients/${u.id}`} className="flex items-center gap-3 hover:text-[var(--accent)]">
                    <div className="size-9 rounded-full bg-[var(--background-elevated)] flex items-center justify-center text-xs font-semibold">
                      {(u.name ?? u.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{u.name ?? "—"}</p>
                      <p className="text-xs text-[var(--foreground-muted)]">{u.email}</p>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs rounded-full bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-1">
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--foreground-muted)]">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString(locale) : "Jamais"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {staff.length === 0 && (
          <div className="text-center py-12 text-sm text-[var(--foreground-muted)]">
            Aucun membre interne. Promeus un user existant depuis sa fiche client (rôle = ADMIN, STAFF_SUPPORT...).
          </div>
        )}
      </div>
    </main>
  );
}
