"use client";

import { useState } from "react";
import {
  Palette,
  User as UserIcon,
  Lock,
  Globe,
  Smartphone,
  Fingerprint,
  Sparkles,
} from "lucide-react";
import { ThemePicker } from "./theme-picker";
import { ProfileForm } from "./settings-profile-form";
import { PasswordChangeForm } from "./settings-password-form";
import { TwoFactorSection } from "./two-factor-section";
import { PasskeysSection } from "./passkeys-section";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing, localeNames, type Locale } from "@/i18n/routing";
import { useLocale } from "next-intl";

interface Props {
  user: {
    name: string;
    email: string;
    phone: string;
    whatsapp: string;
    locale: string;
    hasPassword: boolean;
    twoFactorEnabled: boolean;
    brandLogoUrl: string | null;
    brandColor: string | null;
    brandSenderName: string | null;
    brandWatermark: boolean;
  };
}

type Tab = "profile" | "appearance" | "brand" | "password" | "twofactor" | "passkeys" | "language";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "profile", label: "Profil", icon: UserIcon },
  { id: "appearance", label: "Apparence", icon: Palette },
  { id: "brand", label: "Branding partages", icon: Sparkles },
  { id: "password", label: "Mot de passe", icon: Lock },
  { id: "twofactor", label: "Authentification 2FA", icon: Smartphone },
  { id: "passkeys", label: "Passkeys / Empreinte", icon: Fingerprint },
  { id: "language", label: "Langue", icon: Globe },
];

export function SettingsTabs({ user }: Props) {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
      {/* Sidebar / tabs */}
      <aside className="md:sticky md:top-20 self-start">
        {/* Mobile : scroll horizontal */}
        <nav className="md:hidden flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${
                tab === t.id
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-medium"
                  : "bg-[var(--background-tile)] border border-[var(--border)]"
              }`}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
        </nav>
        {/* Desktop : vertical sidebar */}
        <nav className="hidden md:flex flex-col gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-start transition-colors ${
                tab === t.id
                  ? "bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
                  : "text-[var(--foreground-muted)] hover:bg-[var(--background-tile)] hover:text-[var(--foreground)]"
              }`}
            >
              <t.icon className="size-4 shrink-0" />
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <section className="space-y-4">
        {tab === "profile" && (
          <div className="tile cursor-default !min-h-0">
            <h2 className="text-lg font-semibold mb-1">Profil</h2>
            <p className="text-sm text-[var(--foreground-muted)] mb-4">Nom, email, téléphone, WhatsApp.</p>
            <ProfileForm
              initial={{
                name: user.name,
                email: user.email,
                phone: user.phone,
                whatsapp: user.whatsapp,
                locale: user.locale,
              }}
            />
          </div>
        )}

        {tab === "appearance" && (
          <div className="tile cursor-default !min-h-0">
            <h2 className="text-lg font-semibold mb-1">Apparence</h2>
            <p className="text-sm text-[var(--foreground-muted)] mb-2">
              Choisis ton thème de couleur. Le changement est instantané et synchronisé sur tous tes appareils
              (via cookie).
            </p>
            <ThemePicker />
          </div>
        )}

        {tab === "brand" && (
          <BrandTab
            initial={{
              brandLogoUrl: user.brandLogoUrl,
              brandColor: user.brandColor,
              brandSenderName: user.brandSenderName,
              brandWatermark: user.brandWatermark,
            }}
          />
        )}

        {tab === "password" && (
          <div className="tile cursor-default !min-h-0">
            <h2 className="text-lg font-semibold mb-1">Mot de passe</h2>
            <p className="text-sm text-[var(--foreground-muted)] mb-4">
              Change ton mot de passe. Il devra faire au moins 8 caractères.
            </p>
            {user.hasPassword ? (
              <PasswordChangeForm />
            ) : (
              <p className="text-sm text-[var(--foreground-muted)]">
                Tu es connecté via Google. Change ton mot de passe sur{" "}
                <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                  myaccount.google.com
                </a>
                .
              </p>
            )}
          </div>
        )}

        {tab === "twofactor" && (
          <div className="tile cursor-default !min-h-0">
            <h2 className="text-lg font-semibold mb-1">Authentification à deux facteurs (TOTP)</h2>
            <p className="text-sm text-[var(--foreground-muted)] mb-4">
              Active la 2FA via Google Authenticator, Authy, 1Password ou ton app TOTP préférée.
            </p>
            <TwoFactorSection enabled={user.twoFactorEnabled} />
          </div>
        )}

        {tab === "passkeys" && (
          <div className="tile cursor-default !min-h-0">
            <h2 className="text-lg font-semibold mb-1">Passkeys — empreinte digitale, Face ID</h2>
            <p className="text-sm text-[var(--foreground-muted)] mb-4">
              Touch ID, Face ID, Windows Hello, Yubikey. Plus rapide et plus sûr qu&apos;un mot de passe.
            </p>
            <PasskeysSection />
          </div>
        )}

        {tab === "language" && <LanguageTab />}
      </section>
    </div>
  );
}

// ============================================================
// LANGUAGE TAB — embedded switcher (au lieu d'un message qui pointe vers le header)
// ============================================================
function LanguageTab() {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale() as Locale;

  return (
    <div className="tile cursor-default !min-h-0">
      <h2 className="text-lg font-semibold mb-1">Langue de l&apos;interface</h2>
      <p className="text-sm text-[var(--foreground-muted)] mb-4">
        Choisis ta langue. L&apos;application se rechargera automatiquement.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {routing.locales.map((loc) => (
          <button
            key={loc}
            onClick={() => router.replace(pathname, { locale: loc })}
            className={`rounded-2xl border px-4 py-4 text-start transition-colors ${
              loc === currentLocale
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                : "border-[var(--border)] hover:bg-[var(--background-elevated)]"
            }`}
          >
            <p className="text-2xl mb-1">
              {loc === "fr" ? "🇫🇷" : loc === "en" ? "🇬🇧" : loc === "es" ? "🇪🇸" : "🇮🇱"}
            </p>
            <p className="font-medium text-sm">{localeNames[loc]}</p>
            <p className="text-xs text-[var(--foreground-muted)]">{loc.toUpperCase()}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// BRAND TAB — personnalisation des liens de partage
// ============================================================
function BrandTab({
  initial,
}: {
  initial: {
    brandLogoUrl: string | null;
    brandColor: string | null;
    brandSenderName: string | null;
    brandWatermark: boolean;
  };
}) {
  const [brandLogoUrl, setBrandLogoUrl] = useState(initial.brandLogoUrl ?? "");
  const [brandColor, setBrandColor] = useState(initial.brandColor ?? "#38bdf8");
  const [brandSenderName, setBrandSenderName] = useState(initial.brandSenderName ?? "");
  const [brandWatermark, setBrandWatermark] = useState(initial.brandWatermark);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandLogoUrl: brandLogoUrl.trim() || null,
        brandColor: brandColor || null,
        brandSenderName: brandSenderName.trim() || null,
        brandWatermark,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErr(data?.error ?? "Erreur");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="tile cursor-default !min-h-0">
      <h2 className="text-lg font-semibold mb-1">Branding des liens partagés</h2>
      <p className="text-sm text-[var(--foreground-muted)] mb-4">
        Personnalise l&apos;apparence des pages que voient les destinataires de tes liens. Ton logo
        remplace celui de MyTitanCloud, ta couleur teinte le bouton de téléchargement et les accents.
      </p>

      <div className="space-y-4 max-w-lg">
        <div>
          <label className="text-sm font-medium mb-1 block">URL du logo (PNG / SVG)</label>
          <input
            type="url"
            value={brandLogoUrl}
            onChange={(e) => setBrandLogoUrl(e.target.value)}
            placeholder="https://moncloud.com/logo.png"
            className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
          />
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            Hauteur fixe 32px. Idéalement format PNG/SVG transparent.
          </p>
          {brandLogoUrl.trim() && (
            <div className="mt-2 rounded-lg bg-[var(--background-elevated)] p-3 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brandLogoUrl} alt="" className="h-8 object-contain" />
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Couleur principale</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="w-12 h-10 rounded cursor-pointer border border-[var(--border)] bg-transparent"
            />
            <input
              type="text"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              placeholder="#38bdf8"
              className="flex-1 rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm font-mono"
            />
            <div
              className="size-10 rounded-xl border border-[var(--border)]"
              style={{ background: brandColor }}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Nom affiché comme expéditeur</label>
          <input
            type="text"
            value={brandSenderName}
            onChange={(e) => setBrandSenderName(e.target.value)}
            maxLength={80}
            placeholder="ex: Studio Tom"
            className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
          />
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            Vide = ton nom de compte. Le destinataire verra « {brandSenderName.trim() || "ton nom"} t&apos;a partagé un fichier ».
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-[var(--border)] p-3 hover:bg-[var(--background-elevated)]">
          <input
            type="checkbox"
            checked={brandWatermark}
            onChange={(e) => setBrandWatermark(e.target.checked)}
            className="mt-1 accent-[var(--accent)]"
          />
          <div>
            <p className="text-sm font-medium">Watermark sur les fichiers téléchargés</p>
            <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
              Ajoute « Partagé via {brandSenderName.trim() || "MyTitanCloud"} » en bas des PDFs et
              images téléchargées via tes liens. Utile pour les contrats / devis / photos pro.
            </p>
          </div>
        </label>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={save} disabled={busy} className="btn-primary">
            {busy ? "Sauvegarde…" : "Enregistrer"}
          </button>
          {saved && <span className="text-xs text-[var(--success)]">✓ Sauvegardé</span>}
          {err && <span className="text-xs text-[var(--danger)]">{err}</span>}
        </div>
      </div>
    </div>
  );
}
