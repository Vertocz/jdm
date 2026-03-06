// hooks/useSearchCandidats.ts
import { useState, useEffect, useRef } from 'react';

interface CandidatRecherche {
  id: string;
  nom: string;
  ddn: string;
  description: string;
  photo: string;
  wikidata_id: string;
}

export function useSearchCandidats(query: string, minLength = 2, debounceMs = 400) {
  const [suggestions, setSuggestions] = useState<CandidatRecherche[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Ref vers le contrôleur d'annulation de la requête en cours
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.trim().length < minLength) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      // Annuler la requête précédente si elle est toujours en vol
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      try {
        const response = await fetch(
          `/api/recherche?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        setSuggestions(data.candidats ?? []);
        setShowSuggestions(true);
      } catch (err: unknown) {
        // AbortError = requête annulée volontairement, on ne met pas à jour l'état
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Erreur recherche:', err);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      // Annuler aussi si la query change avant la fin du debounce
      abortControllerRef.current?.abort();
    };
  }, [query, minLength, debounceMs]);

  return { suggestions, loading, showSuggestions, setShowSuggestions };
}