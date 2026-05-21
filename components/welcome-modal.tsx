"use client";

// Modal d'accueil affiché au premier passage sur le dashboard.
// Flag stocké en localStorage (clé : "mytitancloud:welcome-seen"). Pas de DB.

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  Cloud,
  Sparkles,
  FolderOpen,
  Users,
  Share2,
  Settings,
  Lock,
  ArrowRight,
  X,
} from "lucide-react";

const STORAGE_KEY = "mytitancloud:welcome-seen";

export function WelcomeModal({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) setOpen(true);
  }, []);

  function close() {
    window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setOpen(false);
  }

  if (!open) return null;

  const steps = [
    {
      icon: Cloud,
      title: `Bienvenue ${userName} sur MyTitanCloud 👋`,
      desc:
        "Ton cloud personnel : stockage, partage avec ta famille, et liens téléchargeables. Tu as 50 Go gratuits pour commencer. Voici un tour rapide en 30 secondes.",
    },
    {
      icon: FolderOpen,
      title: "Tes fichiers",
      desc:
        "Glisse-dépose pour uploader. Crée des dossiers, déplace les fichiers à la souris. Clic sur la vignette pour un aperçu (image, vidéo, PDF). Clic sur le nom pour sélectionner.",
    },
    {
      icon: Users,
      title: "Famille",
      desc:
        "Crée un espace partagé avec ta famille. Invite-les par email, ils auront accès aux fichiers que tu choisis de partager. Tu peux donner accès à un fichier perso en un clic.",
    },
    {
      icon: Share2,
      title: "Liens de partage",
      desc:
        "Envoie un fichier à n'importe qui sans qu'il ait à créer un compte : génère un lien avec date d'expiration et mot de passe optionnel. Tu vois qui télécharge.",
    },
    {
      icon: Lock,
      title: "Sécurise ton compte",
      desc:
        "Active la 2FA (Google Authenticator) ou un passkey (empreinte / Face ID) depuis les paramètres. C'est en 30 secondes et ça protège contre le piratage.",
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={close}
    >
      <div
        className="relative bg-[var(--background-elevated)] border border-[var(--border)] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="absolute top-3 end-3 p-2 rounded-full hover:bg-[var(--background-tile)] z-10"
          aria-label="Fermer"
        >
          <X className="size-4" />
        </button>

        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)] mb-4">
            <current.icon className="size-8" />
          </div>
          <h2 className="text-2xl font-bold">{current.title}</h2>
          <p className="text-sm text-[var(--foreground-muted)] mt-3 leading-relaxed">{current.desc}</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? "w-6 bg-[var(--accent)]"
                  : i < step
                  ? "w-1.5 bg-[var(--accent)]/40"
                  : "w-1.5 bg-[var(--border)]"
              }`}
              aria-label={`Étape ${i + 1}`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 p-5 bg-[var(--background-tile)] border-t border-[var(--border)]">
          <button
            onClick={close}
            className="text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
          >
            Passer
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)} className="btn-ghost text-sm">
                Précédent
              </button>
            )}
            {isLast ? (
              <Link href="/settings" onClick={close} className="btn-primary text-sm">
                <Sparkles className="size-4" />
                Commencer
              </Link>
            ) : (
              <button onClick={() => setStep((s) => s + 1)} className="btn-primary text-sm">
                Suivant
                <ArrowRight className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
