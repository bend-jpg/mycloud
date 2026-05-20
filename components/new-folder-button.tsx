"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";

export function NewFolderButton({
  parentId,
  teamId,
}: {
  parentId?: string | null;
  teamId?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const name = prompt("Nom du dossier");
    if (!name) return;
    setBusy(true);
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId: parentId ?? null, teamId: teamId ?? null }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else alert("Erreur lors de la création");
  }

  return (
    <button onClick={handleClick} disabled={busy} className="btn-ghost text-sm">
      <FolderPlus className="size-4" />
      Nouveau dossier
    </button>
  );
}
