import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Mentions légales" };

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold">Mentions légales</h1>

        <div className="space-y-6 mt-8 text-[var(--foreground-muted)] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Éditeur du site</h2>
            <p>
              MyCloud<br />
              [Forme juridique : à compléter — SAS / SARL / auto-entrepreneur]<br />
              [Adresse complète : à compléter]<br />
              [SIRET : à compléter]<br />
              [Numéro de TVA intracommunautaire : à compléter]<br />
              Email : contact@mycloud.app
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Directeur de publication</h2>
            <p>[Nom du responsable : à compléter]</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Hébergement</h2>
            <p>
              Le site est hébergé sur l&apos;infrastructure Vercel Inc.<br />
              440 N Barranca Ave #4133, Covina, CA 91723, USA<br />
              vercel.com
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble du contenu de ce site (textes, images, code) est protégé par le droit
              d&apos;auteur. Toute reproduction sans autorisation préalable est interdite.
            </p>
          </section>

          <p className="text-xs italic text-[var(--foreground-muted)] mt-8">
            ⚠️ À compléter avec tes vraies infos avant ouverture commerciale.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
