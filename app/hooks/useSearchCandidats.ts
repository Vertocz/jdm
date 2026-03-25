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

export type SearchError = 'rate_limit' | 'timeout' | 'server_error' | null;

export function useSearchCandidats(query: string, minLength = 2, debounceMs = 400) {
  const [suggestions, setSuggestions] = useState<CandidatRecherche[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchError, setSearchError] = useState<SearchError>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.trim().length < minLength) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearchError(null);
      return;
    }

    const timer = setTimeout(async () => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setSearchError(null);
      try {
        const response = await fetch(
          `/api/recherche?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (response.status === 429 || data.error === 'rate_limit') {
          setSearchError('rate_limit');
          setSuggestions([]);
          setShowSuggestions(true);
          return;
        }

        if (response.status === 504 || data.error === 'timeout') {
          setSearchError('timeout');
          setSuggestions([]);
          setShowSuggestions(true);
          return;
        }

        if (!response.ok) {
          setSearchError('server_error');
          setSuggestions([]);
          setShowSuggestions(true);
          return;
        }

        setSuggestions(data.candidats ?? []);
        setShowSuggestions(true);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Erreur recherche:', err);
        setSearchError('server_error');
        setSuggestions([]);
        setShowSuggestions(true);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      abortControllerRef.current?.abort();
    };
  }, [query, minLength, debounceMs]);

  return { suggestions, loading, showSuggestions, setShowSuggestions, searchError };
}