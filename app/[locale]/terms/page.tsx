import { setRequestLocale } from "next-intl/server";
import { PublicHeader } from "@/components/public-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Conditions générales" };

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-6 py-16 prose prose-invert">
        <h1 className="text-4xl font-bold">Conditions générales d&apos;utilisation et de vente</h1>
        <p className="text-sm text-[var(--foreground-muted)]">Dernière mise à jour : {new Date().toLocaleDateString("fr")}</p>

        <div className="space-y-6 mt-8 text-[var(--foreground-muted)] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">1. Objet</h2>
            <p>
              Les présentes conditions régissent l&apos;utilisation du service MyTitanCloud, plateforme de stockage et
              de partage de fichiers en ligne accessible à mycloud.app (ci-après « le Service »).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">2. Acceptation</h2>
            <p>
              En créant un compte, tu acceptes pleinement et sans réserve les présentes conditions générales
              d&apos;utilisation et de vente. Si tu n&apos;acceptes pas ces conditions, n&apos;utilise pas le Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">3. Compte utilisateur</h2>
            <p>
              Tu es responsable de la confidentialité de tes identifiants. Toute activité réalisée depuis ton
              compte est réputée effectuée par toi. Active la 2FA dans tes paramètres pour renforcer la sécurité.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">4. Tarifs et paiement</h2>
            <p>
              Les tarifs en vigueur sont indiqués sur la page <a href="/#pricing" className="text-[var(--accent)]">Tarifs</a>.
              Les paiements sont acceptés par <strong>carte bancaire</strong> (via Stripe), <strong>cryptomonnaies</strong>
              (BTC, ETH, USDC, etc. via Coinbase Commerce) ou par d&apos;autres moyens accordés à la discrétion de
              l&apos;équipe MyTitanCloud (virement, espèces). L&apos;abonnement est mensuel ou annuel, renouvelé automatiquement
              sauf annulation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">5. Contenu utilisateur</h2>
            <p>
              Tu restes propriétaire des fichiers que tu uploades. Tu garantis disposer des droits nécessaires sur
              ces fichiers. MyTitanCloud se réserve le droit de suspendre tout compte hébergeant du contenu illégal
              (atteinte au droit d&apos;auteur, contenu pédopornographique, etc.) après notification.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">6. Disponibilité du Service</h2>
            <p>
              MyTitanCloud s&apos;efforce d&apos;assurer une disponibilité maximale mais ne peut garantir une absence
              totale d&apos;interruption. Aucune indemnité ne sera due en cas d&apos;indisponibilité ponctuelle.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">7. Données personnelles</h2>
            <p>
              Tes données sont traitées conformément au RGPD. Voir la{" "}
              <a href="/privacy" className="text-[var(--accent)]">politique de confidentialité</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">8. Résiliation</h2>
            <p>
              Tu peux résilier ton abonnement à tout moment depuis ta page « Mon plan ». Les Go restant sur
              l&apos;abonnement sont accessibles jusqu&apos;à la fin de la période payée.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">9. Modifications</h2>
            <p>
              MyTitanCloud se réserve le droit de modifier ces conditions. Les utilisateurs seront informés des
              changements substantiels au moins 30 jours avant leur entrée en vigueur.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">10. Droit applicable</h2>
            <p>
              Les présentes conditions sont soumises au droit français. Tout litige relève des tribunaux compétents.
            </p>
          </section>

          <p className="text-xs italic text-[var(--foreground-muted)] mt-8">
            ⚠️ Ce texte est un modèle de base. Avant la mise en service commerciale, fais-le valider par un juriste
            pour ta juridiction réelle. À adapter selon ta forme juridique (auto-entrepreneur, SARL, etc.) et ton
            pays d&apos;exercice.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
