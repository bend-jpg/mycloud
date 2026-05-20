import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminSidebar } from "@/components/admin-sidebar";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  if (!session.isAdmin) redirect(`/${locale}/dashboard`);

  return (
    <div className="min-h-screen flex">
      <AdminSidebar />
      <div className="flex-1 min-w-0 md:ms-60">
        {/* Espacement pour le bouton menu mobile */}
        <div className="md:hidden h-14" />
        {children}
      </div>
    </div>
  );
}
