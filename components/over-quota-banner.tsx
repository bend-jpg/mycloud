import { Link } from "@/i18n/navigation";
import { AlertTriangle } from "lucide-react";
import { formatBytes } from "@/lib/utils";

/**
 * Bandeau affiché quand l'espace occupé dépasse le quota.
 *
 * Situation typique : le client passe à un forfait inférieur alors qu'il
 * stocke déjà davantage. Sans explication, ses envois échouaient avec un
 * message technique et il ne comprenait ni pourquoi, ni quoi faire.
 *
 * Choix assumé : on ne supprime JAMAIS de fichier automatiquement. Le compte
 * passe en lecture seule pour les nouveaux envois, tout le reste (accès,
 * téléchargement, partage, suppression) continue de fonctionner — c'est ce
 * qui permet à l'utilisateur de revenir sous la limite par lui-même.
 */
export function OverQuotaBanner({
  used,
  quota,
}: {
  used: number;
  quota: number;
}) {
  if (quota <= 0 || used <= quota) return null;

  const excess = used - quota;

  return (
    <div
      role="alert"
      className="rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
    >
      <div className="size-10 rounded-xl bg-[var(--danger)]/20 text-[var(--danger)] flex items-center justify-center shrink-0">
        <AlertTriangle className="size-5" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[var(--danger)]">
          Ton espace est dépassé de {formatBytes(excess)}
        </p>
        <p className="text-sm text-[var(--foreground-muted)] mt-1">
          Tu utilises {formatBytes(used)} pour un forfait de {formatBytes(quota)}. Tes fichiers
          restent accessibles et téléchargeables — <strong>rien n&apos;est supprimé</strong> — mais
          tu ne peux plus en ajouter tant que tu n&apos;es pas repassé sous la limite.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 shrink-0">
        <Link href="/billing" className="btn-primary text-sm">
          Augmenter mon espace
        </Link>
        <Link href="/trash" className="btn-ghost text-sm">
          Vider la corbeille
        </Link>
      </div>
    </div>
  );
}
