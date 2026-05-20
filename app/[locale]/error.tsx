"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[mycloud] erreur globale", error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="tile-icon mx-auto !size-16 !rounded-2xl mb-4 text-[var(--danger)]">
          <AlertTriangle className="size-8" />
        </div>
        <h1 className="text-2xl font-bold">Oups, quelque chose s&apos;est mal passé</h1>
        <p className="text-sm text-[var(--foreground-muted)] mt-2">
          Une erreur est survenue. On a noté le problème.
        </p>
        {error.digest && (
          <p className="text-xs text-[var(--foreground-muted)] mt-3 font-mono">
            Ref : {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="btn-primary">
            <RefreshCw className="size-4" />
            Réessayer
          </button>
          <Link href="/" className="btn-ghost">
            <Home className="size-4" />
            Accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
