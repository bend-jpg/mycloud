import type { Metadata, Viewport } from "next";
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
  title: { default: "MyTitanCloud", template: "%s · MyTitanCloud" },
  description: "Ton cloud personnel, simple et puissant. Stockage, partage et famille en un seul espace.",
  applicationName: "MyTitanCloud",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "MyTitanCloud",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a14" },
    { media: "(prefers-color-scheme: light)", color: "#f7f7fb" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
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
        {/* Skip to content pour la navigation clavier / lecteurs d'écran */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[200] focus:bg-[var(--accent)] focus:text-[var(--accent-foreground)] focus:px-3 focus:py-2 focus:rounded-lg focus:shadow-lg"
        >
          Aller au contenu principal
        </a>
        <Providers>
          <NextIntlClientProvider locale={locale as Locale} messages={messages}>
            <div id="main-content">{children}</div>
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
