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
    if (!userId) {
      return { success: false, error: "Vous devez être connecté" };
    }

    setLoading(true);

    try {
      // 1. Vérifier le nombre de paris en cours pour cette saison
      const { data: parisEnCours, error: countError } = await supabase
        .from('paris')
        .select('id', { count: 'exact' })
        .eq('joueur', userId)
        .eq('saison', saison);

      if (countError) throw countError;

      if (parisEnCours && parisEnCours.length >= 10) {
        setLoading(false);
        return { 
          success: false, 
          error: "Vous avez déjà 10 candidats pour cette saison" 
        };
      }

      // 2. Vérifier si le candidat existe déjà dans la table candidats
      const { data: existingCandidat, error: searchError } = await supabase
        .from('candidats')
        .select('id')
        .eq('wikidata_id', candidat.wikidata_id)
        .maybeSingle();

      if (searchError) throw searchError;

      let candidatId: number;

      if (existingCandidat) {
        // Le candidat existe déjà
        candidatId = existingCandidat.id;

        // Vérifier si le joueur a déjà parié sur ce candidat cette saison
        const { data: existingPari, error: pariCheckError } = await supabase
          .from('paris')
          .select('id')
          .eq('joueur', userId)
          .eq('candidat_id', candidatId)
          .eq('saison', saison)
          .maybeSingle();

        if (pariCheckError) throw pariCheckError;

        if (existingPari) {
          setLoading(false);
          return { 
            success: false, 
            error: "Vous avez déjà parié sur ce candidat cette saison" 
          };
        }
      } else {
        // 3. Insérer le nouveau candidat
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

        if (insertError) throw insertError;
        candidatId = newCandidat.id;
      }

      // 4. Créer le pari
      const { error: pariError } = await supabase
        .from('paris')
        .insert({
          candidat_id: candidatId,
          joueur: userId,
          saison: saison,
          mort: false,
        });

      if (pariError) throw pariError;

      setLoading(false);
      return { success: true };

    } catch (error) {
      console.error("Erreur lors de l'ajout du candidat:", error);
      setLoading(false);
      return { 
        success: false, 
        error: "Une erreur est survenue lors de l'ajout" 
      };
    }
  };

  return { addCandidat, loading };
}