"use client";

// Upload de photo de profil. Drag-drop ou click pour choisir une image.
// Aperçu instantané pendant l'upload + bouton "Supprimer" pour reset.

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, Trash2, Loader2 } from "lucide-react";
import { useToast } from "./toast";

export function AvatarUpload({ currentImage, userName }: { currentImage: string | null; userName: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [image, setImage] = useState(currentImage);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/me/avatar", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.message ?? "Échec upload");
        return;
      }
      setImage(data.image);
      toast.success("Photo de profil mise à jour");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeAvatar() {
    setBusy(true);
    try {
      const res = await fetch("/api/me/avatar", { method: "DELETE" });
      if (res.ok) {
        setImage(null);
        toast.success("Avatar supprimé");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="relative size-20 rounded-full overflow-hidden bg-[var(--background-elevated)] border-2 border-[var(--border)] flex items-center justify-center text-2xl font-bold shrink-0">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={userName} className="w-full h-full object-cover" />
        ) : (
          userName.charAt(0).toUpperCase()
        )}
        {busy && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-white" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">Photo de profil</p>
        <p className="text-xs text-[var(--foreground-muted)] mb-3">
          JPG, PNG, WebP ou GIF · 5 Mo max · format carré recommandé
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="btn-ghost text-sm"
          >
            {image ? <Camera className="size-4" /> : <Upload className="size-4" />}
            {image ? "Changer" : "Choisir une photo"}
          </button>
          {image && (
            <button
              type="button"
              onClick={removeAvatar}
              disabled={busy}
              className="btn-ghost text-sm !text-[var(--danger)]"
            >
              <Trash2 className="size-4" />
              Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
