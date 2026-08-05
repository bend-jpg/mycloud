// Guard pour les pages admin : redirige vers /admin si l'utilisateur n'a pas
// la permission requise (au lieu de notFound, pour qu'il voie au moins l'overview).
//
// ─────────────────────────────────────────────────────────────────────────
// CE GARDE EST OBLIGATOIRE DANS CHAQUE PAGE — le layout ne suffit PAS
// ─────────────────────────────────────────────────────────────────────────
//
// `app/[locale]/(admin)/layout.tsx` fait déjà un contrôle staff, mais ce
// n'est pas une barrière de sécurité : Next rend le layout et la page EN
// PARALLÈLE. La redirection du layout part bien, sauf que la page a déjà
// exécuté ses requêtes entre-temps et que leurs résultats sont déjà
// sérialisés dans le corps de la réponse. Le navigateur redirige et
// n'affiche rien — mais un simple `curl` lit tout.
//
// Constaté en production, sans aucun cookie de session :
//   curl https://mytitancloud.com/admin/storage
//   → HTTP 200 contenant l'endpoint R2 complet (donc l'identifiant du
//     compte Cloudflare), le nom du bucket, les volumes et le nombre de
//     fichiers. Reproductible à l'identique 3 fois sur 3.
//
// 12 des 18 pages admin étaient dans ce cas. Toute NOUVELLE page admin doit
// appeler guardAdminPage() comme première instruction après
// setRequestLocale(), avant la moindre requête.

import { redirect } from "next/navigation";
import { getSession } from "./session";
import { hasPermission, type Permission } from "./permissions";

export async function guardAdminPage(perm: Permission, locale: string) {
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  if (!session.isStaff) redirect(`/${locale}/dashboard`);
  if (!hasPermission(session.role, perm)) {
    redirect(`/${locale}/admin`);
  }
  return session;
}
