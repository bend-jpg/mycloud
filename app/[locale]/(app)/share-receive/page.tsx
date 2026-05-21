// Endpoint Share Target PWA : reçoit des fichiers partagés depuis l'app Photos /
// Galerie / Files du téléphone. Le browser POST en multipart vers cette URL, on
// récupère les blobs côté client via un petit composant qui les passe au
// FileUploader existant.
//
// Comme Next.js ne facilite pas le streaming d'un POST vers un Server Component,
// on utilise une route handler /api/share-receive qui stocke temporairement les
// fichiers en mémoire (limite raisonnable) puis redirige vers /files avec un
// flag — OU plus simple : on rend une page client qui lit les fichiers depuis
// le FormData transmis via service worker (pas trivial sans SW).
//
// Approche V1 pragmatique : on rend une page neutre qui dit "Glisse tes fichiers
// ici" et on laisse le user les redéposer. Pour V2 : ajouter un service worker
// qui intercepte le POST et le passe au client via window.postMessage.

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { FileUploader } from "@/components/file-uploader";
import { Share2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ShareReceivePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login?next=/share-receive`);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 space-y-6">
        <div className="rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent)]/10 to-[var(--secondary)]/10 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-xl bg-[var(--accent)]/15 flex items-center justify-center text-[var(--accent)]">
              <Share2 className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Importer depuis le téléphone</h1>
              <p className="text-sm text-[var(--foreground-muted)]">
                Tu as partagé un fichier depuis ton téléphone. Glisse-le ci-dessous
                pour l&apos;uploader.
              </p>
            </div>
          </div>
        </div>

        <FileUploader folderId={null} />

        <p className="text-xs text-[var(--foreground-muted)] text-center">
          💡 Astuce : installe MyTitanCloud comme app sur ton téléphone (menu navigateur →
          « Ajouter à l&apos;écran d&apos;accueil ») pour qu&apos;il apparaisse dans le menu Partager natif.
        </p>
      </main>
    </>
  );
}
