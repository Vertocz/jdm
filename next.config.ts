// next.config.ts
import type { NextConfig } from "next";

// PWA : l'installation sur l'écran d'accueil repose sur public/manifest.json.
// Le plugin @ducanh2912/next-pwa a été retiré : il dépend de webpack et ne
// générait plus aucun service worker depuis le passage à Turbopack (Next 16).
// public/sw.js est un service worker minimal qui se désinstalle : il nettoie
// les navigateurs qui auraient gardé un ancien service worker.

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    // Les photos viennent de Wikimedia Commons, servies telles quelles.
    unoptimized: true,
  },
};

export default nextConfig;
