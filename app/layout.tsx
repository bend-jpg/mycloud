// Root layout — minimal. Le vrai layout (avec html/body, i18n, RTL)
// se trouve dans app/[locale]/layout.tsx.
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
