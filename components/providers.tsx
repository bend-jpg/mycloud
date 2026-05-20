"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <ThemeProvider
        attribute="data-theme"
        defaultTheme="dark-blue"
        themes={["dark-blue", "dark-amber", "ocean", "light"]}
        enableSystem={false}
      >
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
