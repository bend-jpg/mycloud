"use client";

// Wrapper client qui récupère isAdmin via useSession() pour brancher
// le CommandPalette global. Placé dans <Providers /> pour être disponible
// partout (logged-in ou pas — si pas loggé, isAdmin = false).
//
// On ne monte le CommandPalette qu'après hydratation client, sinon les
// hooks useRouter/usePathname tirés de next-intl plantent pendant la
// génération statique (export errored sur /fr/billing, /fr/admin/payments…).

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CommandPalette } from "./command-palette";

export function CommandPaletteWrapper() {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const isAdmin = session?.user?.role === "ADMIN";
  return <CommandPalette isAdmin={isAdmin} />;
}
