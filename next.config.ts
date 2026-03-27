// next.config.ts
import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";
import fs from "fs";
import path from "path";

// ── En développement, on génère un sw.js minimal qui se désinstalle lui-même.
// Cela évite qu'un ancien Service Worker de prod intercepte les requêtes
// Next.js dev et provoque des 404 ou bloque la navigation.
if (process.env.NODE_ENV === "development") {
  const swPath = path.join(process.cwd(), "public", "sw.js");
  const stub = [
    "// dev-stub : se désinstalle pour ne pas bloquer Next.js",
    "self.addEventListener('install', () => self.skipWaiting());",
    "self.addEventListener('activate', (event) => {",
    "  event.waitUntil(",
    "    self.registration.unregister()",
    "      .then(() => self.clients.matchAll())",
    "      .then(clients => clients.forEach(c => c.navigate(c.url)))",
    "  );",
    "});",
  ].join("\n");
  fs.writeFileSync(swPath, stub, "utf-8");
}

const pwaConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",

  workboxOptions: {
    skipWaiting: true,
    runtimeCaching: [],
    exclude: [/middleware-manifest\.json$/],
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Turbopack activé par défaut sur Next.js 16 — on le déclare
  // explicitement pour éviter l'erreur "webpack config sans turbopack config"
  turbopack: {},

  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "commons.wikimedia.org" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "wlvjzuvxivjyvqlsrhmp.supabase.co" },
    ],
  },
};

export default pwaConfig(nextConfig);