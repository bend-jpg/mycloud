"use client";

// Page download — version 2 : un VRAI bouton "Installer" qui déclenche
// l'install PWA native sur Chrome / Edge / Android sans passer par les
// 3 points du menu. Sur iOS Safari (Apple ne supporte pas beforeinstallprompt),
// on garde une instruction visuelle claire.
//
// WebDAV (montage disque réseau) déménagé en section "Avancé" pliable.

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  Smartphone,
  Apple,
  Monitor,
  Terminal,
  Globe,
  Sparkles,
  Copy,
  Check,
  Download,
  Share,
  PlusSquare,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";

type DetectedOS = "ios" | "android" | "macos" | "windows" | "linux" | "unknown";

function detectOS(): DetectedOS {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Mac/.test(ua) && !/iPhone|iPad/.test(ua)) return "macos";
  if (/Windows/.test(ua)) return "windows";
  if (/Linux/.test(ua)) return "linux";
  return "unknown";
}

// Type Chrome/Edge pour beforeinstallprompt — pas dans TS lib par défaut
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function DownloadCards({ locale: _locale }: { locale: string }) {
  const [os, setOs] = useState<DetectedOS>("unknown");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [davCopied, setDavCopied] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    setOs(detectOS());

    // Détecte si déjà installé en mode standalone
    if (typeof window !== "undefined") {
      const standalone =
        window.matchMedia?.("(display-mode: standalone)").matches ||
        // iOS Safari standalone
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (standalone) setIsInstalled(true);
    }

    // Écoute beforeinstallprompt (Chrome / Edge / Android)
    function onBeforeInstall(e: Event) {
      e.preventDefault(); // empêche le mini-banner auto, on contrôle le moment
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } finally {
      setInstalling(false);
    }
  }

  const davUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}/api/dav`
      : "https://mytitancloud.com/api/dav";

  async function copyDavUrl() {
    await navigator.clipboard.writeText(davUrl);
    setDavCopied(true);
    setTimeout(() => setDavCopied(false), 2000);
  }

  // ============================================================
  // RENDU PRINCIPAL — un gros card avec un VRAI bouton Install
  // ============================================================
  return (
    <div className="space-y-6">
      {/* Card principal — install direct */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-[var(--accent)]/40 bg-gradient-to-br from-[var(--accent)]/10 via-[var(--background-tile)] to-[var(--secondary)]/10 p-6 sm:p-8 animate-fade-in-up">
        <div className="pointer-events-none absolute -top-20 -end-20 size-64 rounded-full bg-[var(--accent)]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -start-20 size-64 rounded-full bg-[var(--secondary)]/15 blur-3xl" />

        <div className="relative flex flex-col items-center text-center">
          <div className="size-16 rounded-3xl bg-[var(--accent)]/20 border border-[var(--accent)]/40 text-[var(--accent)] flex items-center justify-center mb-4 shadow-2xl">
            <Download className="size-8" strokeWidth={1.8} />
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold">
            {isInstalled
              ? "Application installée ✓"
              : "Installe MyTitanCloud sur ton appareil"}
          </h2>
          <p className="text-sm text-[var(--foreground-muted)] mt-2 max-w-md">
            {isInstalled
              ? "L'app est déjà sur ton appareil. Ouvre-la depuis ton écran d'accueil ou ton menu démarrer."
              : "Pas besoin d'App Store ni de Play Store. Un seul clic et l'app s'installe sur ton téléphone, ton Mac ou ton PC."}
          </p>

          {/* État 1 : déjà installé */}
          {isInstalled && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/30 px-4 py-2 text-sm font-medium">
              <CheckCircle2 className="size-4" />
              Application installée sur cet appareil
            </div>
          )}

          {/* État 2 : install prompt dispo (Chrome / Edge / Android) */}
          {!isInstalled && deferredPrompt && (
            <button
              onClick={handleInstallClick}
              disabled={installing}
              className="btn-primary mt-6 !px-8 !py-4 text-base animate-pulse-glow"
            >
              {installing ? "Installation…" : (
                <>
                  <Download className="size-5" />
                  Installer maintenant
                </>
              )}
            </button>
          )}

          {/* État 3 : iOS Safari (pas de beforeinstallprompt — instructions claires) */}
          {!isInstalled && !deferredPrompt && os === "ios" && (
            <IOSInstructions />
          )}

          {/* État 4 : autre navigateur (Firefox, Safari macOS, ou pas encore prêt) */}
          {!isInstalled && !deferredPrompt && os !== "ios" && (
            <FallbackInstructions os={os} />
          )}
        </div>
      </div>

      {/* Section disque réseau (advanced) — caché par défaut */}
      <details
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        className="rounded-3xl border border-[var(--border)] bg-[var(--background-tile)] overflow-hidden"
      >
        <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-[var(--background-elevated)]/40">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[var(--background-elevated)] flex items-center justify-center text-[var(--secondary)]">
              <Monitor className="size-5" />
            </div>
            <div className="text-start">
              <p className="font-semibold">Disque réseau (avancé)</p>
              <p className="text-xs text-[var(--foreground-muted)]">
                Monte MyTitanCloud comme un disque dans le Finder / Explorateur / Linux
              </p>
            </div>
          </div>
          <ChevronDown className={`size-5 text-[var(--foreground-muted)] transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
        </summary>

        <div className="border-t border-[var(--border)] p-5 space-y-5">
          {/* macOS */}
          <div>
            <h4 className="font-semibold flex items-center gap-2 mb-2">
              <Apple className="size-4" /> macOS
            </h4>
            <ol className="text-sm text-[var(--foreground-muted)] space-y-1 list-decimal list-inside">
              <li>Ouvre le Finder, fais Cmd+K</li>
              <li>Colle l&apos;URL ci-dessous, clique « Se connecter »</li>
              <li>Login = ton email · Mot de passe = ton mot de passe MyTitanCloud</li>
            </ol>
          </div>

          {/* Windows */}
          <div>
            <h4 className="font-semibold flex items-center gap-2 mb-2">
              <Monitor className="size-4" /> Windows
            </h4>
            <ol className="text-sm text-[var(--foreground-muted)] space-y-1 list-decimal list-inside">
              <li>Explorateur → clic droit sur « Ce PC » → Connecter un lecteur réseau</li>
              <li>Colle l&apos;URL ci-dessous, choisis une lettre (ex: M:)</li>
              <li>Coche « Utiliser d&apos;autres identifiants »</li>
            </ol>
          </div>

          {/* Linux */}
          <div>
            <h4 className="font-semibold flex items-center gap-2 mb-2">
              <Terminal className="size-4" /> Linux
            </h4>
            <p className="text-sm text-[var(--foreground-muted)]">
              GNOME Files → Autres emplacements → Connexion au serveur → colle l&apos;URL.
            </p>
            <pre className="text-xs bg-[var(--background-elevated)] rounded-xl p-3 overflow-x-auto font-mono text-[var(--foreground-muted)] mt-2">
{`sudo apt install davfs2
sudo mount -t davfs ${davUrl} /mnt/mycloud`}
            </pre>
          </div>

          <UrlCopy url={davUrl} copied={davCopied} onCopy={copyDavUrl} />
        </div>
      </details>

      {/* Pas envie d'installer */}
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--background-tile)] p-5 text-center">
        <Globe className="size-6 text-[var(--accent)] mx-auto mb-2" />
        <p className="text-sm font-medium">Pas envie d&apos;installer ?</p>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          Tout marche pareil depuis ton navigateur — upload, partage, famille, tout.
        </p>
        <Link href="/dashboard" className="btn-primary text-sm mt-3 inline-flex">
          Ouvrir l&apos;app web
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Instructions visuelles pour iOS Safari
// ============================================================
function IOSInstructions() {
  return (
    <div className="mt-6 w-full max-w-md rounded-2xl bg-[var(--background-elevated)] border border-[var(--border)] p-5 text-start">
      <p className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Apple className="size-4" />
        iPhone / iPad — 2 tapotements
      </p>
      <ol className="space-y-3">
        <li className="flex items-start gap-3">
          <span className="shrink-0 size-7 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center text-xs font-bold">1</span>
          <span className="text-sm text-[var(--foreground-muted)]">
            Touche l&apos;icône <Share className="inline size-4 text-[var(--accent)] mx-0.5" /> <strong className="text-[var(--foreground)]">Partager</strong> tout en bas de Safari
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="shrink-0 size-7 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center text-xs font-bold">2</span>
          <span className="text-sm text-[var(--foreground-muted)]">
            Fais défiler et choisis <PlusSquare className="inline size-4 text-[var(--accent)] mx-0.5" /> <strong className="text-[var(--foreground)]">Sur l&apos;écran d&apos;accueil</strong>, puis « Ajouter »
          </span>
        </li>
      </ol>
      <p className="text-[10px] text-[var(--foreground-muted)] mt-3 italic">
        Apple oblige ce parcours — pas possible d&apos;auto-installer comme sur Android.
      </p>
    </div>
  );
}

// ============================================================
// Fallback générique (Firefox, Safari macOS, autres)
// ============================================================
function FallbackInstructions({ os }: { os: DetectedOS }) {
  const browserHint =
    os === "android"
      ? "Ouvre cette page dans Chrome ou Edge pour voir le bouton."
      : os === "macos"
      ? "Ouvre cette page dans Chrome ou Edge pour voir le bouton d'installation. Safari macOS supporte l'install via le menu Fichier → Ajouter au Dock."
      : os === "windows" || os === "linux"
      ? "Ouvre cette page dans Chrome ou Edge pour voir le bouton d'installation."
      : "Ouvre cette page dans Chrome ou Edge pour le bouton d'installation direct.";

  return (
    <div className="mt-6 w-full max-w-md rounded-2xl bg-[var(--background-elevated)] border border-[var(--border)] p-5 text-start">
      <p className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Sparkles className="size-4 text-[var(--accent)]" />
        Comment installer
      </p>
      <p className="text-sm text-[var(--foreground-muted)] mb-3">{browserHint}</p>
      <p className="text-xs text-[var(--foreground-muted)]">
        Sur Chrome/Edge desktop : tu verras une petite icône « + » dans la barre d&apos;adresse,
        en haut à droite — clique-la pour installer en un clic.
      </p>
    </div>
  );
}

function UrlCopy({ url, copied, onCopy }: { url: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={url}
        onClick={(e) => (e.target as HTMLInputElement).select()}
        className="flex-1 rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-xs font-mono"
      />
      <button onClick={onCopy} className="btn-primary !px-3" title="Copier">
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
