// app/layout.tsx
import "./globals.css";
import ConditionalHeader from "./components/ConditionalHeader";

export const metadata = {
  title: "Le Jeu de la Mort",
  description: "Chaque année, constitue ton équipe. Si l'une d'elles disparaît, tu marques des points.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent" as const,
    title: "Le Jeu de la Mort",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: "#0d0d18",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/* iOS : nécessaire car Safari ignore partiellement le manifest */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Le Jeu de la Mort" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body>
        <ConditionalHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
