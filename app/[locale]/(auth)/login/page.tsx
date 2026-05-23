import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Cloud } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.login");

  return (
    <main className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-8">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8 text-lg font-semibold">
          <Cloud className="size-6 text-[var(--accent)]" />
          MyTitanCloud
        </Link>
        <div className="tile cursor-default">
          <h1 className="text-2xl font-bold">{t("title")}</h1>

          <Suspense fallback={<div className="mt-4 h-40 animate-pulse bg-[var(--background-elevated)] rounded-xl" />}>
            <LoginForm />
          </Suspense>

          {process.env.NODE_ENV === "development" && (
            <p className="text-xs text-[var(--foreground-muted)] mt-4 text-center rounded-lg bg-[var(--background-elevated)] p-3">
              💡 Dev : <code>demo@mycloud.local</code> / <code>demo123</code>
            </p>
          )}

          <p className="text-sm text-center mt-4 text-[var(--foreground-muted)]">
            {t("noAccount")}{" "}
            <Link href="/signup" className="text-[var(--accent)] hover:underline">
              {t("createAccount")}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
