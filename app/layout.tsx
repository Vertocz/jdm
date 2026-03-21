// app/layout.tsx
import "./globals.css";
import ConditionalHeader from "./components/ConditionalHeader";

export const metadata = {
  title: "Le Jeu de la Mort",
  description: "Chaque année, constitue ton équipe. Si l'une d'elles disparaît, tu marques des points.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {/* Sur "/", la nav est intégrée dans page.tsx.
            Sur les autres pages, ConditionalHeader affiche le Header standard. */}
        <ConditionalHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}