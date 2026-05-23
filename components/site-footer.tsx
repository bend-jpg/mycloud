import { Link } from "@/i18n/navigation";
import { Cloud, CreditCard, Bitcoin } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-[var(--border)] bg-[var(--background-elevated)]/40 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div className="col-span-2 md:col-span-1">
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
            <Cloud className="size-5 text-[var(--accent)]" />
            MyTitanCloud
          </Link>
          <p className="text-[var(--foreground-muted)] mt-3 text-xs leading-relaxed">
            Ton cloud personnel et familial : stockage, partage et collaboration en un seul espace.
            Hébergé en Europe.
          </p>
          <div className="flex items-center gap-3 mt-4 text-[var(--foreground-muted)]">
            <span className="flex items-center gap-1 text-xs" title="Paiements par carte">
              <CreditCard className="size-4" /> CB
            </span>
            <span className="flex items-center gap-1 text-xs" title="Paiements en crypto">
              <Bitcoin className="size-4" /> Crypto
            </span>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-[var(--foreground)] mb-3">Produit</h3>
          <ul className="space-y-2 text-[var(--foreground-muted)]">
            <li><Link href="/#features" className="hover:text-[var(--foreground)]">Fonctionnalités</Link></li>
            <li><Link href="/#pricing" className="hover:text-[var(--foreground)]">Tarifs</Link></li>
            <li><Link href="/signup" className="hover:text-[var(--foreground)]">Créer un compte</Link></li>
            <li><Link href="/login" className="hover:text-[var(--foreground)]">Se connecter</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-[var(--foreground)] mb-3">Société</h3>
          <ul className="space-y-2 text-[var(--foreground-muted)]">
            <li><Link href="/contact" className="hover:text-[var(--foreground)]">Contact</Link></li>
            <li><Link href="/about" className="hover:text-[var(--foreground)]">À propos</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-[var(--foreground)] mb-3">Légal</h3>
          <ul className="space-y-2 text-[var(--foreground-muted)]">
            <li><Link href="/terms" className="hover:text-[var(--foreground)]">CGU / CGV</Link></li>
            <li><Link href="/privacy" className="hover:text-[var(--foreground)]">Confidentialité</Link></li>
            <li><Link href="/legal" className="hover:text-[var(--foreground)]">Mentions légales</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 text-xs text-[var(--foreground-muted)] flex flex-col sm:flex-row justify-between gap-2">
          <p>© {new Date().getFullYear()} MyTitanCloud. Tous droits réservés.</p>
          <p>Hébergement Cloudflare R2 · DB Neon · CDN Vercel · Made with 💙</p>
        </div>
      </div>
    </footer>
  );
}
