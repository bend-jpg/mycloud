import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Cloud } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ verified?: string }>;
}) {
  const { locale } = await params;
  const { verified } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("auth.login");

  // Retour de confirmation d'adresse email (/api/auth/verify-email y renvoie)
  const verifyNotice =
    verified === "ok"
      ? { tone: "success" as const, text: "Ton adresse est confirmée. Tu peux te connecter." }
      : verified === "expired"
      ? { tone: "warn" as const, text: "Ce lien de confirmation a expiré. Connecte-toi pour en recevoir un nouveau." }
      : verified === "invalid"
      ? { tone: "warn" as const, text: "Lien de confirmation invalide ou déjà utilisé." }
      : null;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-8">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8 text-lg font-semibold">
          <Cloud className="size-6 text-[var(--accent)]" />
          MyTitanCloud
        </Link>
        <div className="tile cursor-default">
          <h1 className="text-2xl font-bold">{t("title")}</h1>

          {verifyNotice && (
            <p
              className={`mt-4 rounded-xl px-3 py-2 text-sm border ${
                verifyNotice.tone === "success"
                  ? "bg-[var(--success)]/10 border-[var(--success)]/30 text-[var(--success)]"
                  : "bg-yellow-400/10 border-yellow-400/30 text-yellow-400"
              }`}
            >
              {verifyNotice.text}
            </p>
          )}

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
