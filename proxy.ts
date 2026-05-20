// Next.js 16 : "middleware" s'appelle désormais "proxy".
// next-intl reste compatible — on monte sa fonction comme default export.

import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlProxy = createIntlMiddleware(routing);

export function proxy(request: Request) {
  return intlProxy(request as Parameters<typeof intlProxy>[0]);
}

export const config = {
  matcher: [
    // Toutes les routes sauf API, _next, fichiers statiques
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
