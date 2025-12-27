// hooks/useAddCandidat.ts
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface CandidatRecherche {
  id: string;
  nom: string;
  ddn: string;
  description?: string;
  photo?: string;
  wikidata_id: string;
}

interface UseAddCandidatResult {
  addCandidat: (candidat: CandidatRecherche, saison: number) => Promise<{
    success: boolean;
    error?: string;
  }>;
  loading: boolean;
}

export function useAddCandidat(userId: string | undefined): UseAddCandidatResult {
  const [loading, setLoading] = useState(false);

  const addCandidat = async (candidat: CandidatRecherche, saison: number) => {
    console.log("🚀 Début addCandidat", { candidat, saison, userId });
    
    if (!userId) {
      console.log("❌ Pas d'userId");
      return { success: false, error: "Vous devez être connecté" };
    }

    setLoading(true);

    try {
      // 1. Vérifier le nombre de paris en cours pour cette saison
      console.log("📊 Vérification du nombre de paris...");
      const { data: parisEnCours, error: countError } = await supabase
        .from('paris')
        .select('id', { count: 'exact' })
        .eq('joueur', userId)
        .eq('saison', saison)
        .eq('mort', false);

      console.log("Résultat count:", { parisEnCours, countError });

      if (countError) throw countError;

      if (parisEnCours && parisEnCours.length >= 10) {
        console.log("❌ Déjà 10 paris");
        setLoading(false);
        return { 
          success: false, 
          error: "Vous avez déjà 10 candidats pour cette saison" 
        };
      }

      // 2. Vérifier si le candidat existe déjà dans la table candidats
      console.log("🔍 Recherche du candidat existant...");
      const { data: existingCandidat, error: searchError } = await supabase
        .from('candidats')
        .select('id')
        .eq('wikidata_id', candidat.wikidata_id)
        .maybeSingle();

      console.log("Résultat recherche:", { existingCandidat, searchError });

      if (searchError) throw searchError;

      let candidatId: number;

      if (existingCandidat) {
        // Le candidat existe déjà
        console.log("✅ Candidat existe déjà, id:", existingCandidat.id);
        candidatId = existingCandidat.id;

        // Vérifier si le joueur a déjà parié sur ce candidat cette saison
        console.log("🔍 Vérification pari existant...");
        const { data: existingPari, error: pariCheckError } = await supabase
          .from('paris')
          .select('id')
          .eq('joueur', userId)
          .eq('candidat_id', candidatId)
          .eq('saison', saison)
          .maybeSingle();

        console.log("Résultat pari existant:", { existingPari, pariCheckError });

        if (pariCheckError) throw pariCheckError;

        if (existingPari) {
          console.log("❌ Pari existe déjà");
          setLoading(false);
          return { 
            success: false, 
            error: "Vous avez déjà parié sur ce candidat cette saison" 
          };
        }
      } else {
        // 3. Insérer le nouveau candidat
        console.log("➕ Insertion nouveau candidat...");
        const { data: newCandidat, error: insertError } = await supabase
          .from('candidats')
          .insert({
            nom: candidat.nom,
            ddn: candidat.ddn,
            ddd: null,
            description: candidat.description || '',
            photo: candidat.photo || '',
            wikidata_id: candidat.wikidata_id,
          })
          .select('id')
          .single();

        console.log("Résultat insertion:", { newCandidat, insertError });

        if (insertError) throw insertError;
        candidatId = newCandidat.id;
      }

      // 4. Créer le pari
      console.log("➕ Création du pari...");
      const { error: pariError } = await supabase
        .from('paris')
        .insert({
          candidat_id: candidatId,
          joueur: userId,
          saison: saison,
          mort: false,
        });

      console.log("Résultat création pari:", { pariError });

      if (pariError) throw pariError;

      console.log("✅ Succès !");
      setLoading(false);
      return { success: true };

    } catch (error: any) {
      console.error("Erreur lors de l'ajout du candidat:", error);
      console.error("Détails de l'erreur:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      });
      setLoading(false);
      return { 
        success: false, 
        error: error?.message || "Une erreur est survenue lors de l'ajout" 
      };
    }
  };

  return { addCandidat, loading };
}
