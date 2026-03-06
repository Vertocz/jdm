// hooks/useAddCandidat.ts
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface CandidatRecherche {
  id: string;
  nom: string;
  ddn: string;
  description?: string;
  photo?: string;
  wikidata_id: string;
}

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
  // useRef pour le guard anti-double-clic : pas de stale closure possible
  const loadingRef = useRef(false);

  const addCandidat = useCallback(async (
    candidat: CandidatRecherche,
    saison: number
  ): Promise<AddCandidatResult> => {
    if (!userId) {
      return { success: false, error: 'Vous devez être connecté' };
    }

    // Guard via ref — immunisé contre les stale closures du useCallback
    if (loadingRef.current) {
      return { success: false, error: 'Opération déjà en cours' };
    }

    loadingRef.current = true;
    setLoading(true);

    try {
      // 1. Compter les paris actifs (mort=false uniquement)
      const { count: activeCount, error: countError } = await supabase
        .from('paris')
        .select('*', { count: 'exact', head: true })
        .eq('joueur', userId)
        .eq('saison', saison)
        .eq('mort', false);

      if (countError) throw countError;

      if (activeCount !== null && activeCount >= 10) {
        return { success: false, error: 'Vous avez déjà 10 candidats actifs pour cette saison' };
      }

      // 2. Upsert du candidat sans écraser les données existantes (ignoreDuplicates: true)
      //    → Si le candidat existe déjà en base (même wikidata_id), on récupère son id sans le modifier.
      //      En particulier, on ne remet pas ddd à null si la personne est déjà décédée en base.
      const { data: upsertedCandidat, error: upsertError } = await supabase
        .from('candidats')
        .upsert(
          {
            nom: candidat.nom,
            ddn: candidat.ddn || null,
            ddd: null,
            description: candidat.description ?? '',
            photo: candidat.photo ?? '',
            wikidata_id: candidat.wikidata_id,
          },
          {
            onConflict: 'wikidata_id',
            ignoreDuplicates: true, // Ne jamais écraser un candidat existant (ddd inclus)
          }
        )
        .select('id')
        .maybeSingle();

      if (upsertError) throw upsertError;

      // Si ignoreDuplicates: true et le candidat existait déjà, upsertedCandidat est null.
      // On le récupère manuellement.
      let candidatId: number;

      if (upsertedCandidat) {
        candidatId = upsertedCandidat.id;
      } else {
        const { data: existing, error: fetchError } = await supabase
          .from('candidats')
          .select('id')
          .eq('wikidata_id', candidat.wikidata_id)
          .single();

        if (fetchError || !existing) throw fetchError ?? new Error('Candidat introuvable');
        candidatId = existing.id;
      }

      // 3. Vérifier l'unicité du pari (joueur × candidat × saison)
      const { count: existingPariCount, error: pariCheckError } = await supabase
        .from('paris')
        .select('*', { count: 'exact', head: true })
        .eq('joueur', userId)
        .eq('candidat_id', candidatId)
        .eq('saison', saison);

      if (pariCheckError) throw pariCheckError;

      if (existingPariCount && existingPariCount > 0) {
        return { success: false, error: 'Vous avez déjà parié sur ce candidat cette saison' };
      }

      // 4. Insérer le pari
      const { error: pariError } = await supabase
        .from('paris')
        .insert({
          candidat_id: candidatId,
          joueur: userId,
          saison,
          mort: false,
        });

      if (pariError) {
        // Violation de contrainte unique = double clic ayant passé la vérification simultanément
        if (pariError.code === '23505') {
          return { success: false, error: 'Vous avez déjà parié sur ce candidat cette saison' };
        }
        throw pariError;
      }

      return { success: true };

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue';
      console.error('Erreur addCandidat:', err);
      return { success: false, error: message };
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [userId]); // userId uniquement — plus de `loading` dans les deps

  return { addCandidat, loading };
}