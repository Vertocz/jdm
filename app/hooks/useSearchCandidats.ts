// hooks/useSearchCandidats.ts
import { useState, useEffect } from 'react';

interface CandidatRecherche {
  id: string;
  nom: string;
  ddn: string;
  description: string;
  photo: string;
  wikidata_id: string;
}

export function useSearchCandidats(query: string, minLength = 2, debounceMs = 500) {
  const [suggestions, setSuggestions] = useState<CandidatRecherche[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false); // ← Ajout

  useEffect(() => {
    if (query.trim().length < minLength) {
      setSuggestions([]);
      setShowSuggestions(false); // ← Cacher quand vide
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/recherche?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        setSuggestions(data.candidats || []);
        setShowSuggestions(true); // ← Afficher quand résultats arrivent
      } catch (error) {
        console.error("Erreur recherche:", error);
        setSuggestions([]);
        setShowSuggestions(false);
      }
      setLoading(false);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, minLength, debounceMs]);

  return { suggestions, loading, showSuggestions, setShowSuggestions }; // ← Retourner tout
}