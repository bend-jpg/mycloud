// Layout du groupe (app) — toutes les pages logged-in. Ajoute le mobile
// bottom bar pour la navigation rapide sur petit écran, plus un padding
// bottom pour éviter que le contenu ne soit caché sous la barre.

import { MobileBottomBar } from "@/components/mobile-bottom-bar";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* pb-20 md:pb-0 : sur mobile, on laisse 5rem en bas pour la barre.
          Sur md+ pas besoin (la barre disparaît). */}
      <div className="pb-20 md:pb-0">{children}</div>
      <MobileBottomBar />
    </>
  );
}
