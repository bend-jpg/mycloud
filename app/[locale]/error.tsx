"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home, LifeBuoy } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[mytitancloud] erreur globale", error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Décors */}
      <div className="pointer-events-none absolute -top-32 -end-32 size-96 rounded-full bg-[var(--danger)]/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -start-32 size-96 rounded-full bg-yellow-400/10 blur-3xl" />

      <div className="relative w-full max-w-lg text-center">
        <div className="inline-flex items-center justify-center size-20 rounded-3xl bg-[var(--danger)]/15 text-[var(--danger)] mb-6 border border-[var(--danger)]/30 shadow-2xl">
          <AlertTriangle className="size-10" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold">Oups, quelque chose s&apos;est mal passé</h1>
        <p className="text-sm text-[var(--foreground-muted)] mt-3 max-w-md mx-auto">
          Une erreur inattendue est survenue. On l&apos;a enregistrée et on regarde ce qui se passe.
          Tu peux réessayer, ou contacter le support si ça persiste.
        </p>

        {error.digest && (
          <div className="mt-6 inline-block rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] px-3 py-2">
            <p className="text-xs text-[var(--foreground-muted)]">
              Référence à donner au support :
            </p>
            <p className="text-xs font-mono mt-0.5">{error.digest}</p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="btn-primary">
            <RefreshCw className="size-4" />
            Réessayer
          </button>
          <Link href="/dashboard" className="btn-ghost text-sm">
            <Home className="size-4" />
            Mon espace
          </Link>
          <Link href="/support" className="btn-ghost text-sm">
            <LifeBuoy className="size-4" />
            Contacter le support
          </Link>
        </div>
      </div>
    </main>
  );
}
