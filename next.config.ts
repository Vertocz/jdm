// next.config.ts
import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

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

  // ✅ Fix : indique explicitement à Next.js 16 que Turbopack est voulu,
  // et qu'il n'y a pas de config Turbopack personnalisée (la config webpack
  // vient du plugin PWA et peut être ignorée par Turbopack sans erreur).
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