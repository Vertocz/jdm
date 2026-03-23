// hooks/useAddCandidat.ts
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CandidatRecherche } from "@/types";

interface AddCandidatResult {
  success: boolean;
  error?: string;
}

interface UseAddCandidatResult {
  addCandidat: (candidat: CandidatRecherche, saison: number) => Promise<AddCandidatResult>;
  loading: boolean;
}

export function useAddCandidat(userId: string | undefined): UseAddCandidatResult {
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  const addCandidat = useCallback(
    async (candidat: CandidatRecherche, saison: number): Promise<AddCandidatResult> => {
      if (!userId) return { success: false, error: "Vous devez être connecté" };
      if (loadingRef.current) return { success: false, error: "Opération déjà en cours" };

      loadingRef.current = true;
      setLoading(true);

      try {
        // Récupérer le token JWT pour l'envoyer à la route API
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          return { success: false, error: "Session expirée, veuillez vous reconnecter" };
        }

        // Toute la validation se passe désormais côté serveur
        const res = await fetch("/api/paris", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            wikidata_id:  candidat.wikidata_id,
            saison,
            nom:         candidat.nom,
            ddn:         candidat.ddn || null,
            description: candidat.description ?? "",
            photo:       candidat.photo ?? "",
          }),
        });

        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error ?? "Une erreur est survenue" };
        return { success: true };
      } catch (err: unknown) {
        console.error("Erreur addCandidat:", err);
        return { success: false, error: err instanceof Error ? err.message : "Une erreur est survenue" };
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [userId]
  );

  return { addCandidat, loading };
}
