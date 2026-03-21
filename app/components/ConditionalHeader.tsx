// app/components/ConditionalHeader.tsx
"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";

/**
 * Affiche le Header standard sur toutes les pages sauf "/",
 * qui possède sa propre navigation intégrée dans le hero.
 */
export default function ConditionalHeader() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <Header />;
}