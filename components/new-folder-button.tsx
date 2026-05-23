"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Loader2 } from "lucide-react";
import { useToast } from "./toast";
import { PromptDialog } from "./prompt-dialog";

export function NewFolderButton({
  parentId,
  teamId,
}: {
  parentId?: string | null;
  teamId?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(name: string) {
    setBusy(true);
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId: parentId ?? null, teamId: teamId ?? null }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success(`Dossier « ${name} » créé`);
      setOpen(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Erreur lors de la création");
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} disabled={busy} className="btn-ghost text-sm">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <FolderPlus className="size-4" />}
        Nouveau dossier
      </button>
      <PromptDialog
        open={open}
        title="Nouveau dossier"
        placeholder="Mes vacances 2026"
        hint="Maximum 100 caractères, pas de / dans le nom"
        submitLabel="Créer"
        validate={(v) => {
          if (v.length > 100) return "Nom trop long (max 100 caractères)";
          if (v.includes("/") || v.includes("\\")) return "Caractères / et \\ interdits";
          return null;
        }}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  );
}
