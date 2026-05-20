import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, isRtl, type Locale } from "@/i18n/routing";
import { Providers } from "@/components/providers";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: { default: "MyCloud", template: "%s · MyCloud" },
  description: "Ton cloud personnel, simple et puissant. Stockage, partage et famille en un seul espace.",
  icons: { icon: "/favicon.ico" },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const dir = isRtl(locale) ? "rtl" : "ltr";
  const messages = (await import(`@/messages/${locale}.json`)).default;

  const hasGoogle = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${inter.variable} h-full`}
      suppressHydrationWarning
      data-has-google={hasGoogle ? "1" : "0"}
    >
      <body className="min-h-full">
        <Providers>
          <NextIntlClientProvider locale={locale as Locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
