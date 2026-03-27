// next.config.ts
import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const pwaConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  // Ici, on ne met que les options propres au plugin
  
  workboxOptions: {
    // TOUTES les options de comportement du Service Worker vont ici
    skipWaiting: true,
    runtimeCaching: [], // Vide si tu veux vraiment gérer le cache à la main
    
    // ATTENTION : 'buildExcludes' de l'ancien next-pwa 
    // s'appelle simplement 'exclude' dans les options Workbox officielles
    exclude: [/middleware-manifest\.json$/],
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
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