"use client";

import { useState } from "react";
import {
  Palette,
  User as UserIcon,
  Lock,
  Globe,
  Smartphone,
  Fingerprint,
} from "lucide-react";
import { ThemePicker } from "./theme-picker";
import { ProfileForm } from "./settings-profile-form";
import { PasswordChangeForm } from "./settings-password-form";
import { TwoFactorSection } from "./two-factor-section";
import { PasskeysSection } from "./passkeys-section";

interface Props {
  user: {
    name: string;
    email: string;
    phone: string;
    whatsapp: string;
    locale: string;
    hasPassword: boolean;
    twoFactorEnabled: boolean;
  };
}

type Tab = "profile" | "appearance" | "password" | "twofactor" | "passkeys" | "language";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "profile", label: "Profil", icon: UserIcon },
  { id: "appearance", label: "Apparence", icon: Palette },
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

        {tab === "language" && (
          <div className="tile cursor-default !min-h-0">
            <h2 className="text-lg font-semibold mb-1">Langue</h2>
            <p className="text-sm text-[var(--foreground-muted)] mb-4">
              Utilise le sélecteur en haut à droite de l&apos;écran pour changer la langue de l&apos;interface
              (Français, English, Español, עברית).
            </p>
            <p className="text-xs text-[var(--foreground-muted)]">
              Ta langue actuelle : <strong>{user.locale.toUpperCase()}</strong>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
