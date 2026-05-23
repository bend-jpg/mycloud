import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { Shield, Check, X } from "lucide-react";
import { AdminStaffRow } from "@/components/admin-staff-row";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHero } from "@/components/page-hero";

export default async function AdminStaffPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await guardAdminPage("page.staff", locale);

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
      <PageHero
        icon={Shield}
        variant="violet"
        title="Équipe interne"
        description={`${staff.length} membre(s) avec accès au back-office. Clique sur un membre pour gérer son rôle.`}
      />

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--background-elevated)] text-[var(--foreground-muted)] text-xs uppercase">
            <tr>
              <th className="text-start px-4 py-3">Membre</th>
              <th className="text-start px-4 py-3">Rôle</th>
              <th className="text-start px-4 py-3 hidden sm:table-cell">2FA</th>
              <th className="text-start px-4 py-3 hidden md:table-cell">Statut</th>
              <th className="text-start px-4 py-3 hidden md:table-cell">Dernière connexion</th>
              <th className="w-10 px-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {staff.map((u) => (
              <AdminStaffRow
                key={u.id}
                locale={locale}
                user={{
                  id: u.id,
                  name: u.name,
                  email: u.email,
                  role: u.role,
                  twoFactorEnabled: u.twoFactorEnabled,
                  suspendedAt: u.suspendedAt?.toISOString() ?? null,
                  lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
                }}
              />
            ))}
          </tbody>
        </table>
        {staff.length === 0 && (
          <div className="text-center py-12 text-sm text-[var(--foreground-muted)]">
            <Shield className="size-10 mx-auto mb-2 opacity-30" />
            Aucun membre interne. Promeus un utilisateur existant depuis sa fiche client.
          </div>
        )}
      </div>

      {/* Matrice des permissions */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-x-auto">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h2 className="font-semibold">Qui peut faire quoi ?</h2>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            Référence rapide des accès par rôle dans le back-office.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[var(--background-elevated)] text-[var(--foreground-muted)] text-xs uppercase">
            <tr>
              <th className="text-start px-4 py-3">Page / Fonctionnalité</th>
              <th className="text-center px-2 py-3">Super-admin</th>
              <th className="text-center px-2 py-3">Support</th>
              <th className="text-center px-2 py-3">Comptable</th>
              <th className="text-center px-2 py-3">Ops</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] text-xs">
            <PermRow label="Vue d'ensemble (KPIs, alertes)" admin support billing ops />
            <PermRow label="Clients (lister, voir fiche)" admin support billing ops />
            <PermRow label="Clients (modifier, suspendre, supprimer)" admin />
            <PermRow label="Voir fichiers d'un client (lecture seule)" admin support ops />
            <PermRow label="Plans tarifaires (lire)" admin support billing />
            <PermRow label="Plans tarifaires (créer/modifier/supprimer)" admin />
            <PermRow label="Codes promo (créer/désactiver)" admin billing />
            <PermRow label="Paiements (lister + filtrer)" admin support billing />
            <PermRow label="Paiements (changer statut / supprimer)" admin billing />
            <PermRow label="Support tickets (lire + répondre)" admin support />
            <PermRow label="Stockage (lire backends + coûts)" admin ops billing />
            <PermRow label="Stockage (ajouter/modifier/supprimer)" admin ops />
            <PermRow label="Équipe interne (lister)" admin />
            <PermRow label="Équipe interne (changer rôle / suspendre)" admin />
            <PermRow label="CMS landing (modifier textes)" admin />
            <PermRow label="Journal d'audit" admin />
          </tbody>
        </table>
        <p className="px-4 py-3 text-xs text-[var(--foreground-muted)] border-t border-[var(--border)]">
          ℹ️ V1 : tous les rôles non-USER ont actuellement accès à toutes les pages admin
          (l&apos;application vérifie juste <code>session.isAdmin</code>). Cette grille décrit l&apos;intention
          de séparation que tu peux affiner via les helpers <code>requireRole()</code> dans le code.
        </p>
      </div>
    </main>
  );
}

function PermRow({
  label,
  admin,
  support,
  billing,
  ops,
}: {
  label: string;
  admin?: boolean;
  support?: boolean;
  billing?: boolean;
  ops?: boolean;
}) {
  const Yes = () => <Check className="size-4 text-[var(--success)] inline" />;
  const No = () => <X className="size-4 text-[var(--foreground-muted)]/40 inline" />;
  return (
    <tr>
      <td className="px-4 py-2">{label}</td>
      <td className="px-2 py-2 text-center">{admin ? <Yes /> : <No />}</td>
      <td className="px-2 py-2 text-center">{support ? <Yes /> : <No />}</td>
      <td className="px-2 py-2 text-center">{billing ? <Yes /> : <No />}</td>
      <td className="px-2 py-2 text-center">{ops ? <Yes /> : <No />}</td>
    </tr>
  );
}
