import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { SubAccountsManager } from "@/components/sub-accounts-manager";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default async function AccountsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const me = await db.user.findUnique({
    where: { id: session.id },
    select: {
      storageQuota: true,
      storageUsed: true,
      parentUserId: true,
      plan: { select: { name: true } },
    },
  });
  if (!me) redirect(`/${locale}/login`);

  // Un sous-compte ne peut pas créer de sous-compte
  if (me.parentUserId) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-6 py-12 text-center">
          <h1 className="text-2xl font-bold">Pas disponible</h1>
          <p className="text-[var(--foreground-muted)] mt-2">
            Ton compte est un sous-compte. Demande au titulaire du plan de créer d&apos;autres accès.
          </p>
          <Link href="/dashboard" className="btn-primary mt-6 inline-flex">
            <ChevronLeft className="size-4 rtl:rotate-180" />
            Mon espace
          </Link>
        </main>
      </>
    );
  }

  const subAccounts = await db.user.findMany({
    where: { parentUserId: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      storageQuota: true,
      storageUsed: true,
      lastLoginAt: true,
      createdAt: true,
      suspendedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Liste des teams dont le user est OWNER (pour ajouter le sub à un team)
  const ownedTeams = await db.team.findMany({
    where: { ownerId: session.id },
    select: { id: true, name: true, type: true },
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
          Retour à mon espace
        </Link>

        <div>
          <h1 className="text-3xl font-bold">Mes utilisateurs</h1>
          <p className="text-[var(--foreground-muted)] mt-1">
            Donne à d&apos;autres personnes un accès à une portion de ton stockage.
            Elles auront leur propre login et leur propre espace.
          </p>
        </div>

        <SubAccountsManager
          parentQuotaBytes={me.storageQuota.toString()}
          parentUsedBytes={me.storageUsed.toString()}
          planName={me.plan?.name ?? "—"}
          initialSubAccounts={subAccounts.map((s) => ({
            id: s.id,
            name: s.name ?? "—",
            email: s.email,
            storageQuotaBytes: s.storageQuota.toString(),
            storageUsedBytes: s.storageUsed.toString(),
            lastLoginAt: s.lastLoginAt?.toISOString() ?? null,
            createdAt: s.createdAt.toISOString(),
            suspended: !!s.suspendedAt,
          }))}
          ownedTeams={ownedTeams.map((t) => ({ id: t.id, name: t.name, type: t.type }))}
        />
      </main>
    </>
  );
}
