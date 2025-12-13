// app/layout.tsx
import "./globals.css";
import Header from "./components/Header";

export const metadata = {
  title: "Le Jeu de la Mort",
  description: "Site minimal avec Supabase + Next.js",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
