"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Loader2 } from "lucide-react";
import { useToast } from "./toast";

export function NewFolderButton({
  parentId,
  teamId,
}: {
  parentId?: string | null;
  teamId?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const name = prompt("Nom du dossier");
    if (!name || !name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), parentId: parentId ?? null, teamId: teamId ?? null }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success(`Dossier « ${name.trim()} » créé`);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Erreur lors de la création");
    }
  }

  return (
    <button onClick={handleClick} disabled={busy} className="btn-ghost text-sm">
      {busy ? <Loader2 className="size-4 animate-spin" /> : <FolderPlus className="size-4" />}
      Nouveau dossier
    </button>
  );
}
