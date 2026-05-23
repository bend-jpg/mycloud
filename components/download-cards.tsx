"use client";

// Affiche 4 cards : Mobile (PWA), Mac, Windows, Linux. Détecte l'OS du visiteur
// au mount et met en avant le bon CTA (le card recommandé a un ring coloré).

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  Smartphone,
  Apple,
  Monitor,
  Terminal,
  Globe,
  ChevronDown,
  Sparkles,
  Copy,
  Check,
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

export function DownloadCards({ locale: _locale }: { locale: string }) {
  const [os, setOs] = useState<DetectedOS>("unknown");
  const [davUrlCopied, setDavUrlCopied] = useState(false);

  useEffect(() => {
    setOs(detectOS());
  }, []);

  const isMobile = os === "ios" || os === "android";
  const isMac = os === "macos";
  const isWindows = os === "windows";
  const isLinux = os === "linux";

  const davUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}/api/dav`
      : "https://mytitancloud.com/api/dav";

  async function copyDavUrl() {
    await navigator.clipboard.writeText(davUrl);
    setDavUrlCopied(true);
    setTimeout(() => setDavUrlCopied(false), 2000);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Mobile PWA */}
      <DownloadCard
        recommended={isMobile}
        icon={Smartphone}
        color="cyan"
        title={os === "ios" ? "iPhone / iPad" : os === "android" ? "Android" : "Mobile (iOS / Android)"}
        subtitle="App native installable en 1 tap"
      >
        <p className="text-sm text-[var(--foreground-muted)]">
          Pas besoin d&apos;App Store. Ouvre <strong className="text-[var(--foreground)]">mytitancloud.com</strong>
          {" "}dans ton navigateur, puis :
        </p>
        <details className="rounded-xl bg-[var(--background-elevated)] p-3" {...(os === "ios" ? { open: true } : {})}>
          <summary className="flex items-center justify-between cursor-pointer">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Apple className="size-4" />
              iPhone / iPad (Safari)
            </span>
            <ChevronDown className="size-4" />
          </summary>
          <ol className="mt-3 space-y-2 text-xs text-[var(--foreground-muted)] list-decimal list-inside">
            <li>Touche le bouton « Partager » en bas de Safari (carré + flèche)</li>
            <li>Fais défiler et touche « Sur l&apos;écran d&apos;accueil »</li>
            <li>Touche « Ajouter » en haut à droite</li>
          </ol>
        </details>
        <details className="rounded-xl bg-[var(--background-elevated)] p-3" {...(os === "android" ? { open: true } : {})}>
          <summary className="flex items-center justify-between cursor-pointer">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Smartphone className="size-4" />
              Android (Chrome)
            </span>
            <ChevronDown className="size-4" />
          </summary>
          <ol className="mt-3 space-y-2 text-xs text-[var(--foreground-muted)] list-decimal list-inside">
            <li>Touche le menu ⋮ en haut à droite de Chrome</li>
            <li>Touche « Installer l&apos;application » ou « Ajouter à l&apos;écran d&apos;accueil »</li>
            <li>Valide l&apos;installation</li>
          </ol>
        </details>
        <p className="text-[10px] text-[var(--foreground-muted)] mt-2">
          ✓ Apparaît dans ton menu Partager · ✓ Notifications push · ✓ Hors ligne (lecture)
        </p>
      </DownloadCard>

      {/* macOS */}
      <DownloadCard
        recommended={isMac}
        icon={Apple}
        color="violet"
        title="macOS"
        subtitle="Monté comme disque réseau dans le Finder"
      >
        <ol className="space-y-2 text-sm list-decimal list-inside text-[var(--foreground-muted)]">
          <li>Ouvre le Finder</li>
          <li>
            Cmd+K (ou menu <em>Aller → Se connecter au serveur</em>)
          </li>
          <li>
            Colle l&apos;URL ci-dessous puis clique « Se connecter »
          </li>
          <li>Login : ton email · Mot de passe : ton mot de passe MyTitanCloud</li>
        </ol>
        <UrlCopy url={davUrl} copied={davUrlCopied} onCopy={copyDavUrl} />
      </DownloadCard>

      {/* Windows */}
      <DownloadCard
        recommended={isWindows}
        icon={Monitor}
        color="amber"
        title="Windows"
        subtitle="Connexion de lecteur réseau dans l'Explorateur"
      >
        <ol className="space-y-2 text-sm list-decimal list-inside text-[var(--foreground-muted)]">
          <li>Ouvre l&apos;Explorateur de fichiers</li>
          <li>
            Clic droit sur « Ce PC » → « <em>Connecter un lecteur réseau</em> »
          </li>
          <li>Lettre au choix (ex: M:), dossier = l&apos;URL ci-dessous</li>
          <li>Coche « Se reconnecter à l&apos;ouverture » et « Utiliser d&apos;autres identifiants »</li>
          <li>Login : ton email · Mot de passe : ton mot de passe MyTitanCloud</li>
        </ol>
        <UrlCopy url={davUrl} copied={davUrlCopied} onCopy={copyDavUrl} />
        <p className="text-[10px] text-[var(--foreground-muted)] mt-2">
          ⚠ Si Windows refuse HTTPS, active WebClient via Services → WebClient (démarrage auto).
        </p>
      </DownloadCard>

      {/* Linux */}
      <DownloadCard
        recommended={isLinux}
        icon={Terminal}
        color="green"
        title="Linux"
        subtitle="Montage via davfs2 ou Files Nautilus"
      >
        <p className="text-sm text-[var(--foreground-muted)]">
          <strong className="text-[var(--foreground)]">Avec GNOME Files :</strong> Autres
          emplacements → Connexion au serveur → colle l&apos;URL ci-dessous.
        </p>
        <p className="text-sm text-[var(--foreground-muted)]">
          <strong className="text-[var(--foreground)]">En CLI (davfs2) :</strong>
        </p>
        <pre className="text-xs bg-[var(--background-elevated)] rounded-xl p-3 overflow-x-auto font-mono text-[var(--foreground-muted)]">
{`sudo apt install davfs2
sudo mkdir /mnt/mytitancloud
sudo mount -t davfs ${davUrl} /mnt/mytitancloud`}
        </pre>
        <UrlCopy url={davUrl} copied={davUrlCopied} onCopy={copyDavUrl} />
      </DownloadCard>

      {/* Fallback : juste le navigateur */}
      <div className="md:col-span-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--background-tile)] p-5 text-center">
        <Globe className="size-6 text-[var(--accent)] mx-auto mb-2" />
        <p className="text-sm font-medium">Pas envie d&apos;installer ? Utilise simplement le navigateur</p>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          Toutes les fonctionnalités sont disponibles depuis le web : upload, partage, famille…
        </p>
        <Link href="/dashboard" className="btn-primary text-sm mt-3 inline-flex">
          Ouvrir l&apos;app web
        </Link>
      </div>
    </div>
  );
}

function DownloadCard({
  recommended,
  icon: Icon,
  color,
  title,
  subtitle,
  children,
}: {
  recommended: boolean;
  icon: React.ComponentType<{ className?: string }>;
  color: "cyan" | "amber" | "violet" | "green";
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const colorClass = {
    cyan: "border-[var(--accent)]/40 bg-gradient-to-br from-[var(--accent)]/10 to-transparent",
    amber: "border-[var(--secondary)]/40 bg-gradient-to-br from-[var(--secondary)]/10 to-transparent",
    violet: "border-violet-500/40 bg-gradient-to-br from-violet-500/10 to-transparent",
    green: "border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-transparent",
  }[color];

  const iconColor = {
    cyan: "text-[var(--accent)]",
    amber: "text-[var(--secondary)]",
    violet: "text-violet-400",
    green: "text-emerald-400",
  }[color];

  return (
    <div
      className={`relative rounded-3xl border bg-[var(--background-tile)] p-5 sm:p-6 space-y-4 ${
        recommended ? `ring-2 ${colorClass}` : "border-[var(--border)]"
      }`}
    >
      {recommended && (
        <span className="absolute -top-3 start-4 text-[10px] uppercase tracking-wide font-semibold rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] px-2.5 py-1 flex items-center gap-1 shadow-lg">
          <Sparkles className="size-3" />
          Recommandé pour toi
        </span>
      )}
      <div className="flex items-center gap-3">
        <div className={`size-12 rounded-2xl bg-[var(--background-elevated)] flex items-center justify-center ${iconColor}`}>
          <Icon className="size-6" />
        </div>
        <div>
          <h3 className="font-bold text-lg">{title}</h3>
          <p className="text-xs text-[var(--foreground-muted)]">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
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
      <button onClick={onCopy} className="btn-primary px-3" title="Copier">
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
