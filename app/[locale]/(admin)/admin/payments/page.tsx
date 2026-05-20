import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/utils";

export default async function AdminPaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const payments = await db.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  return (
    <main className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Paiements</h1>
        <p className="text-[var(--foreground-muted)] mt-1">200 derniers mouvements.</p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--background-elevated)] text-[var(--foreground-muted)] text-xs uppercase">
            <tr>
              <th className="text-start px-4 py-3">Date</th>
              <th className="text-start px-4 py-3">Client</th>
              <th className="text-end px-4 py-3">Montant</th>
              <th className="text-start px-4 py-3">Méthode</th>
              <th className="text-start px-4 py-3">Statut</th>
              <th className="text-start px-4 py-3">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 text-xs">{new Date(p.createdAt).toLocaleString(locale)}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/clients/${p.user.id}`} className="hover:text-[var(--accent)]">
                    {p.user.name ?? p.user.email}
                  </Link>
                </td>
                <td className="px-4 py-3 text-end font-semibold">
                  {formatPrice(p.amount, p.currency as "EUR" | "USD")}
                </td>
                <td className="px-4 py-3 text-xs">{p.method}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs rounded-full px-2 py-1 ${
                      p.status === "SUCCEEDED"
                        ? "text-[var(--success)] bg-[var(--success)]/10"
                        : p.status === "PENDING"
                        ? "text-yellow-400 bg-yellow-400/10"
                        : "text-[var(--danger)] bg-[var(--danger)]/10"
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--foreground-muted)] max-w-xs truncate" title={p.notes ?? ""}>
                  {p.notes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && (
          <p className="text-center text-sm text-[var(--foreground-muted)] py-12">Aucun paiement enregistré.</p>
        )}
      </div>
    </main>
  );
}
