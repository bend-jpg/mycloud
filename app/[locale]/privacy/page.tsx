import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Politique de confidentialité" };

export default async function PrivacyPage({
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
        <h1 className="text-4xl font-bold">Politique de confidentialité</h1>
        <p className="text-sm text-[var(--foreground-muted)]">Dernière mise à jour : {new Date().toLocaleDateString("fr")}</p>

        <div className="space-y-6 mt-8 text-[var(--foreground-muted)] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Données collectées</h2>
            <p>Nous collectons les données suivantes :</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Email, nom, téléphone (optionnel), WhatsApp (optionnel) — au compte</li>
              <li>Mot de passe hashé via bcrypt (jamais en clair)</li>
              <li>Fichiers que tu uploades — stockés chiffrés sur nos serveurs ou serveurs partenaires</li>
              <li>Logs de connexion : IP, date, user-agent (purgés après 90 jours)</li>
              <li>Paiements : montants, dates, méthode (mais jamais ton numéro de carte — Stripe / Coinbase Commerce)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Utilisation</h2>
            <p>Tes données servent uniquement à :</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Faire fonctionner le Service (login, stockage, partage)</li>
              <li>Te facturer</li>
              <li>Te répondre quand tu nous écris</li>
              <li>Améliorer le Service (statistiques anonymisées)</li>
            </ul>
            <p className="mt-2">
              Nous ne vendons jamais tes données et ne les partageons avec aucun tiers à des fins commerciales.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Hébergement</h2>
            <p>
              Tes données sont hébergées sur des serveurs en Europe :
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Base de données : Neon (UE-Central, Francfort)</li>
              <li>Fichiers : Cloudflare R2 (régions configurables, par défaut UE)</li>
              <li>Application : Vercel (CDN mondial, infrastructure aux US — mais accès logs anonymisés)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Tes droits (RGPD)</h2>
            <p>Tu peux à tout moment :</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Accéder à tes données depuis ton compte</li>
              <li>Les modifier (page Paramètres → Profil)</li>
              <li>Les exporter (sur demande à contact@mycloud.app)</li>
              <li>Supprimer ton compte (via ticket support — suppression définitive sous 30 jours)</li>
              <li>Te plaindre à la CNIL si tu estimes que tes droits ne sont pas respectés</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Cookies</h2>
            <p>
              Nous utilisons uniquement des cookies techniques (session de connexion, choix de thème, langue).
              Pas de tracking, pas de pub, pas d&apos;analytics tiers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Contact</h2>
            <p>
              Pour toute question : <a href="/contact" className="text-[var(--accent)]">page contact</a> ou{" "}
              <a href="mailto:contact@mycloud.app" className="text-[var(--accent)]">contact@mycloud.app</a>.
            </p>
          </section>

          <p className="text-xs italic text-[var(--foreground-muted)] mt-8">
            ⚠️ Modèle de base. Adapte aux noms réels de ta société et fais valider par un juriste / DPO.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
