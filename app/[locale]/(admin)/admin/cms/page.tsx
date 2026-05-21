// Page admin pour éditer les textes de la landing (CMS minimaliste).
// Une colonne par locale, formulaire par clé. Champ vide = on retombe sur le i18n par défaut.

export const dynamic = "force-dynamic";

import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { CMS_KEYS, getSupportedLocales } from "@/lib/cms";
import { CmsEditor } from "@/components/admin-cms-editor";
import { FileText } from "lucide-react";

export default async function AdminCmsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const locales = getSupportedLocales();
  const allBlocks = await db.cmsBlock.findMany({
    where: { locale: { in: [...locales] } },
    select: { locale: true, key: true, value: true, updatedAt: true },
  });

  // Construit { locale: { key: value } } pour passer au client component
  const byLocale: Record<string, Record<string, string>> = {};
  for (const loc of locales) byLocale[loc] = {};
  for (const b of allBlocks) byLocale[b.locale][b.key] = b.value;

  return (
    <main className="p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <FileText className="size-7 text-[var(--accent)]" />
          CMS — Textes de la landing
        </h1>
        <p className="text-sm text-[var(--foreground-muted)] mt-1">
          Modifie les textes affichés sur la page d&apos;accueil par langue. Champ vide = on
          retombe sur la traduction par défaut (fichiers <code>messages/&lt;locale&gt;.json</code>).
          Les changements sont visibles immédiatement après sauvegarde.
        </p>
      </div>

      <CmsEditor
        locales={[...locales]}
        keys={CMS_KEYS.map((k) => ({ ...k }))}
        initial={byLocale}
      />
    </main>
  );
}
