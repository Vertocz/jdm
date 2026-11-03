// utils/pseudo.ts
// Règles du pseudo, identiques à la contrainte profiles_display_name_format en base.
import { supabase } from "@/lib/supabaseClient";

export function validerPseudo(pseudo: string): string | null {
  const p = pseudo.trim();
  if (!p) return "Le pseudo est obligatoire";
  if (p.length < 3) return "Le pseudo doit contenir au moins 3 caractères";
  if (p.length > 30) return "Le pseudo doit contenir au plus 30 caractères";
  if (/[<>]/.test(p)) return "Le pseudo ne peut pas contenir < ou >";
  return null;
}

/** Échappe % et _ qui sont des jokers dans un ILIKE. */
function echapperLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => "\\" + c);
}

/** Le pseudo est-il déjà pris (sans tenir compte des majuscules) par un autre joueur ? */
export async function pseudoDejaPris(pseudo: string, saufUserId?: string): Promise<boolean> {
  let q = supabase.from("profiles").select("user_id").ilike("display_name", echapperLike(pseudo.trim()));
  if (saufUserId) q = q.neq("user_id", saufUserId);
  const { data } = await q.limit(1);
  return (data?.length ?? 0) > 0;
}
