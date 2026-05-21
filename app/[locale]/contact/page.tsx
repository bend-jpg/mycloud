import { setRequestLocale } from "next-intl/server";
import { PublicHeader } from "@/components/public-header";
import { SiteFooter } from "@/components/site-footer";
import { ContactForm } from "@/components/contact-form";
import { Mail, MessageCircle, MapPin } from "lucide-react";

export const metadata = { title: "Contact" };

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const whatsapp = process.env.WHATSAPP_BUSINESS_NUMBER ?? null;

  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-6 py-16 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold">Contacte-nous</h1>
          <p className="text-[var(--foreground-muted)] mt-3">
            Une question, une demande de devis, un partenariat ? Écris-nous, on répond sous 24h.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="tile cursor-default !min-h-0 text-center">
            <Mail className="size-6 text-[var(--accent)] mx-auto mb-2" />
            <p className="text-sm font-medium">Email</p>
            <a href="mailto:contact@mycloud.app" className="text-xs text-[var(--foreground-muted)] hover:text-[var(--accent)]">
              contact@mycloud.app
            </a>
          </div>
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tile group cursor-pointer text-center !min-h-0"
            >
              <MessageCircle className="size-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-medium">WhatsApp</p>
              <p className="text-xs text-[var(--foreground-muted)]">Réponse rapide</p>
            </a>
          )}
          <div className="tile cursor-default !min-h-0 text-center">
            <MapPin className="size-6 text-[var(--secondary)] mx-auto mb-2" />
            <p className="text-sm font-medium">Adresse</p>
            <p className="text-xs text-[var(--foreground-muted)]">
              Hébergement Europe<br />Données stockées en UE
            </p>
          </div>
        </div>

        <div className="tile cursor-default !min-h-0">
          <h2 className="text-xl font-semibold mb-4">Envoie-nous un message</h2>
          <ContactForm />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
