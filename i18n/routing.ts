import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en", "es", "he"] as const,
  defaultLocale: "fr",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

export const localeNames: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  he: "עברית",
};

export const localeFlags: Record<Locale, string> = {
  fr: "FR",
  en: "EN",
  es: "ES",
  he: "HE",
};

export const rtlLocales: Locale[] = ["he"];

export function isRtl(locale: string): boolean {
  return rtlLocales.includes(locale as Locale);
}
