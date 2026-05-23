// /file-requests — page de gestion des liens "Envoie-moi des fichiers".

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { PageHero } from "@/components/page-hero";
import { BackLink } from "@/components/back-link";
import { FileRequestsManager } from "@/components/file-requests-manager";
import { Inbox } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FileRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  // Defensive : si la table FileRequest n'a pas été pushée en prod, on retourne []
  let items: {
    id: string;
    token: string;
    title: string;
    message: string | null;
    folderId: string | null;
    folderName: string | null;
    maxFiles: number;
    maxFileSizeBytes: string;
    expiresAt: string | null;
    hasPassword: boolean;
    uploadCount: number;
    createdAt: string;
  }[] = [];
  try {
    const requests = await db.fileRequest.findMany({
      where: { ownerId: session.id, revokedAt: null },
      orderBy: { createdAt: "desc" },
      include: { folder: { select: { id: true, name: true } } },
    });
    items = requests.map((r) => ({
      id: r.id,
      token: r.token,
      title: r.title,
      message: r.message,
      folderId: r.folderId,
      folderName: r.folder?.name ?? null,
      maxFiles: r.maxFiles,
      maxFileSizeBytes: r.maxFileSizeBytes.toString(),
      expiresAt: r.expiresAt?.toISOString() ?? null,
      hasPassword: !!r.passwordHash,
      uploadCount: r.uploadCount,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch {
    items = [];
  }

  // Dossiers du user pour le formulaire de création
  const folders = await db.folder.findMany({
    where: { ownerId: session.id, isTrash: false, teamId: null },
    orderBy: { path: "asc" },
    select: { id: true, name: true, path: true },
    take: 200,
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-6">
        <BackLink />
        <PageHero
          icon={Inbox}
          variant="cyan"
          title="Demandes de fichiers"
          description="Crée un lien à envoyer à quelqu'un (sans compte cloud) pour qu'il puisse t'envoyer ses fichiers directement dans ton espace."
        />
        <FileRequestsManager initialItems={items} folders={folders} />
      </main>
    </>
  );
}
