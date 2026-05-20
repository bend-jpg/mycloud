import { FileQuestion, Home } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="tile-icon mx-auto !size-16 !rounded-2xl mb-4">
          <FileQuestion className="size-8" />
        </div>
        <h1 className="text-5xl font-bold">404</h1>
        <p className="text-xl mt-2">Page introuvable</p>
        <p className="text-sm text-[var(--foreground-muted)] mt-2">
          Cette page n&apos;existe pas, ou tu n&apos;as pas l&apos;autorisation d&apos;y accéder.
        </p>
        <div className="mt-6">
          <Link href="/" className="btn-primary">
            <Home className="size-4" />
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
