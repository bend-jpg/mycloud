import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, isRtl, type Locale } from "@/i18n/routing";
import { Providers } from "@/components/providers";
import { CommandPaletteWrapper } from "@/components/command-palette-wrapper";
import { SwRegister } from "@/components/sw-register";
import { getAppUrl } from "@/lib/url";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

const SITE_URL = getAppUrl();
const SITE_NAME = "MyTitanCloud";
const SITE_DESC = "Ton cloud personnel, simple et puissant. Stockage, partage WeTransfer-like, et famille en un seul espace. 50 Go gratuits.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESC,
  applicationName: SITE_NAME,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  // Open Graph (Facebook, LinkedIn, WhatsApp, iMessage…)
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESC,
    url: SITE_URL,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — ton cloud personnel`,
      },
    ],
    locale: "fr_FR",
    alternateLocale: ["en_US", "es_ES", "he_IL"],
  },
  // Twitter card
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESC,
    images: ["/og.png"],
  },
  // SEO
  keywords: [
    "cloud personnel",
    "stockage en ligne",
    "WeTransfer alternative",
    "partage de fichiers",
    "cloud familial",
    "NAS",
    "drive sécurisé",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
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
            {/* Doit être INSIDE NextIntlClientProvider — sinon son useRouter
                de @/i18n/navigation plante côté client. */}
            <CommandPaletteWrapper />
            {/* Service Worker — indispensable pour que Chrome/Edge déclenchent
                beforeinstallprompt et permettent l'installation PWA en un clic. */}
            <SwRegister />
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
