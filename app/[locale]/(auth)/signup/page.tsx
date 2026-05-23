import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Cloud } from "lucide-react";
import { SignupForm } from "@/components/signup-form";

export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.signup");

  return (
    <main className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-8">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8 text-lg font-semibold">
          <Cloud className="size-6 text-[var(--accent)]" />
          MyTitanCloud
        </Link>
        <div className="tile cursor-default">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <SignupForm locale={locale} />
          <p className="text-sm text-center mt-4 text-[var(--foreground-muted)]">
            {t("haveAccount")}{" "}
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              {t("login")}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
