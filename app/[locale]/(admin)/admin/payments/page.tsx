import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { AdminPaymentRow } from "@/components/admin-payment-row";
import { Search, Filter, CreditCard } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Pagination, buildPageHref } from "@/components/pagination";
import { guardAdminPage } from "@/lib/admin-guard";

export default async function AdminPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string; method?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Autorisation AVANT toute requête. Le garde du layout ne protège pas :
  // Next rend layout et page en parallèle, donc sans ce contrôle la page
  // interroge la base et ses données partent dans la réponse malgré la
  // redirection. Vérifié en production sur /admin/storage.
  await guardAdminPage("page.payments", locale);
  const { q, status, method, page } = await searchParams;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (method) where.method = method;
  if (q) {
    where.OR = [
      { invoiceNumber: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { user: { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } },
    ];
  }

  const PER_PAGE = 50;
  const currentPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);

  // Le total encaissé est agrégé sur TOUT le jeu filtré (pas sur la page
  // affichée) : un chiffre d'affaires qui changerait en tournant les pages
  // serait trompeur.
  const [payments, stats, totalCount] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { user: { select: { id: true, email: true, name: true } } },
    }),
    db.payment.aggregate({
      where: { ...where, status: "SUCCEEDED" },
      _sum: { amount: true },
      _count: true,
    }),
    db.payment.count({ where }),
  ]);

  const totalEur = (stats._sum.amount ?? 0) / 100;
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  return (
    <main className="p-4 sm:p-8 space-y-6">
      <PageHero
        icon={CreditCard}
        variant="green"
        title="Paiements"
        description={
          <>
            {totalCount} résultat(s) · page {currentPage} sur {totalPages} · Total encaissés :{" "}
            <strong className="text-[var(--foreground)]">{totalEur.toFixed(2)} €</strong> sur {stats._count} paiements
          </>
        }
      />

      <form className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-60">
          <Search className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)]" />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Email, nom, facture, note…"
            className="w-full rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] ps-10 pe-4 py-2 text-sm"
          />
        </div>
        <select name="status" defaultValue={status ?? ""} className="rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] px-3 py-2 text-sm">
          <option value="">Tous statuts</option>
          <option value="SUCCEEDED">Payé</option>
          <option value="PENDING">En attente</option>
          <option value="FAILED">Échoué</option>
          <option value="REFUNDED">Remboursé</option>
        </select>
        <select name="method" defaultValue={method ?? ""} className="rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] px-3 py-2 text-sm">
          <option value="">Toutes méthodes</option>
          <option value="CARD_STRIPE">Carte (Stripe)</option>
          <option value="CRYPTO">Crypto</option>
          <option value="CASH">Espèces</option>
          <option value="BANK_TRANSFER">Virement</option>
          <option value="OTHER">Autre</option>
        </select>
        <button type="submit" className="btn-primary text-sm"><Filter className="size-4" /> Filtrer</button>
      </form>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--background-elevated)] text-[var(--foreground-muted)] text-xs uppercase">
            <tr>
              <th className="text-start px-4 py-3">Date</th>
              <th className="text-start px-4 py-3">Client</th>
              <th className="text-end px-4 py-3">Montant</th>
              <th className="text-start px-4 py-3">Méthode</th>
              <th className="text-start px-4 py-3">Statut</th>
              <th className="text-start px-4 py-3">Note</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {payments.map((p) => (
              <AdminPaymentRow
                key={p.id}
                payment={{
                  id: p.id,
                  userId: p.user.id,
                  userName: p.user.name ?? p.user.email,
                  amount: p.amount,
                  currency: p.currency,
                  method: p.method,
                  status: p.status,
                  notes: p.notes,
                  invoiceNumber: p.invoiceNumber,
                  invoiceUrl: p.invoiceUrl,
                  paidAt: p.paidAt?.toISOString() ?? null,
                  createdAt: p.createdAt.toISOString(),
                }}
              />
            ))}
          </tbody>
        </table>
        {payments.length === 0 && (
          <div className="text-center py-16 px-6">
            <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-[var(--background-elevated)] text-[var(--foreground-muted)] mb-3">
              <CreditCard className="size-7" />
            </div>
            <p className="text-base font-medium">Aucun paiement trouvé</p>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">
              {q || status || method
                ? "Modifie tes filtres pour voir plus de résultats."
                : "Les paiements apparaîtront ici dès qu'un client souscrira."}
            </p>
          </div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        label="Pagination des paiements"
        buildHref={(p) => buildPageHref("/admin/payments", { q, status, method }, p)}
      />
    </main>
  );
}
