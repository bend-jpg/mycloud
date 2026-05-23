"use client";

// Fallback ULTIME quand même le layout root crashe.
// Doit définir son propre <html> + <body> car le layout n'est pas chargé.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[mytitancloud] global-error (root)", error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#0a0a14",
          color: "#f5f5f7",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "480px", textAlign: "center" }}>
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>💥</div>
          <h1 style={{ fontSize: "24px", margin: "0 0 8px" }}>
            Erreur critique
          </h1>
          <p style={{ color: "#a1a1aa", lineHeight: 1.5, fontSize: "14px" }}>
            L&apos;application a rencontré une erreur fatale. Recharge la page pour réessayer.
          </p>
          {error.digest && (
            <p
              style={{
                color: "#71717a",
                fontFamily: "monospace",
                fontSize: "12px",
                marginTop: "16px",
              }}
            >
              Ref : {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: "24px",
              background: "#38bdf8",
              color: "#0a0a14",
              padding: "12px 24px",
              borderRadius: "999px",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Recharger
          </button>
        </div>
      </body>
    </html>
  );
}
