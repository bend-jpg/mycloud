"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "./toast";

// NOTE: CommandPaletteWrapper a été déplacé dans [locale]/layout.tsx
// INSIDE NextIntlClientProvider — sinon son useRouter de @/i18n/navigation
// plante côté client (pas de contexte locale dispo). Bug observé en prod
// après Round 38 : « erreur critique » sur toutes les pages.

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <ThemeProvider
        attribute="data-theme"
        defaultTheme="dark-blue"
        themes={["dark-blue", "dark-amber", "ocean", "light"]}
        enableSystem={false}
      >
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
