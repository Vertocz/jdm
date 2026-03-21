import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  images: {
    // Next.js proxifie les images externes côté serveur pour les optimiser.
    // Avec des sources comme Wikimedia Commons (many images, concurrent requests),
    // cela génère des 429. On désactive l'optimizer : le navigateur charge
    // directement depuis la source, sans passer par le serveur Next.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "commons.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "wlvjzuvxivjyvqlsrhmp.supabase.co",
      },
    ],
  },
};

export default nextConfig;