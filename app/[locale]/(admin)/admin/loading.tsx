import { Loader2 } from "lucide-react";

export default function AdminLoading() {
  return (
    <main className="p-8 min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-[var(--foreground-muted)]">
        <Loader2 className="size-8 animate-spin text-[var(--accent)]" />
        <p className="text-sm">Chargement…</p>
      </div>
    </main>
  );
}
