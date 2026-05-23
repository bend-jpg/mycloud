import { FileQuestion, Home, Search, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Décors */}
      <div className="pointer-events-none absolute -top-32 -end-32 size-96 rounded-full bg-[var(--accent)]/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -start-32 size-96 rounded-full bg-[var(--secondary)]/15 blur-3xl" />

      <div className="relative w-full max-w-lg text-center">
        {/* Big 404 stylé */}
        <div className="relative inline-block mb-4">
          <span className="text-[140px] sm:text-[180px] font-black leading-none bg-gradient-to-br from-[var(--accent)] to-[var(--secondary)] bg-clip-text text-transparent select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="size-20 rounded-2xl bg-[var(--background-tile)]/80 backdrop-blur border border-[var(--border)] flex items-center justify-center text-[var(--accent)] shadow-2xl">
              <FileQuestion className="size-10" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold">Page introuvable</h1>
        <p className="text-sm text-[var(--foreground-muted)] mt-3 max-w-md mx-auto">
          La page que tu cherches n&apos;existe plus, a été déplacée, ou tu n&apos;as pas
          l&apos;autorisation d&apos;y accéder. Vérifie l&apos;URL ou retourne à l&apos;accueil.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link href="/" className="btn-primary">
            <Home className="size-4" />
            Accueil
          </Link>
          <Link href="/dashboard" className="btn-ghost text-sm">
            <ArrowLeft className="size-4" />
            Mon espace
          </Link>
        </div>

        <div className="mt-12 text-xs text-[var(--foreground-muted)]">
          <p>Tu cherches quelque chose en particulier ?</p>
          <div className="flex items-center justify-center gap-4 mt-2 flex-wrap">
            <Link href="/files" className="hover:text-[var(--accent)]">
              <Search className="size-3 inline me-1" />
              Mes fichiers
            </Link>
            <span>·</span>
            <Link href="/family" className="hover:text-[var(--accent)]">
              Famille
            </Link>
            <span>·</span>
            <Link href="/support" className="hover:text-[var(--accent)]">
              Support
            </Link>
            <span>·</span>
            <Link href="/billing" className="hover:text-[var(--accent)]">
              Mon plan
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
