// Guard pour les pages admin : redirige vers /admin si l'utilisateur n'a pas
// la permission requise (au lieu de notFound, pour qu'il voie au moins l'overview).

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
