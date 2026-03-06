// app/components/SearchBar.tsx
"use client";

import { useRef } from "react";
import { useSearchCandidats } from "@/app/hooks/useSearchCandidats";
import { useClickOutside } from "@/app/hooks/useClickOutside";
import { CandidatRecherche } from "@/types";

interface SearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (candidat: CandidatRecherche) => void;
  placeholder?: string;
  borderColor?: string;
}

export default function SearchBar({
  query,
  onQueryChange,
  onSelect,
  placeholder = "Rechercher une personnalité...",
  borderColor = "var(--text)",
}: SearchBarProps) {
  const searchRef = useRef<HTMLDivElement>(null);
  const { suggestions, loading, showSuggestions, setShowSuggestions } =
    useSearchCandidats(query);

  useClickOutside(searchRef, () => setShowSuggestions(false));

  const handleSelect = (candidat: CandidatRecherche) => {
    onSelect(candidat);
    setShowSuggestions(false);
    onQueryChange("");
  };

  return (
    <div ref={searchRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && suggestions.length > 0) {
              handleSelect(suggestions[0]);
            }
          }}
          style={{
            width: "100%",
            padding: "15px 20px",
            fontSize: "1.1rem",
            border: `2px solid ${borderColor}`,
            borderRadius: "12px",
            background: "rgba(78, 57, 41, 0.2)",
            color: "var(--text)",
            fontFamily: "Quicksand, sans-serif",
            outline: "none",
            transition: "all 0.2s ease",
          }}
        />
        {loading && (
          <div
            style={{
              position: "absolute",
              right: "15px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--c2)",
            }}
          >
            Recherche...
          </div>
        )}
      </div>

      {/* Liste de suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          className="suggestions-list"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "8px",
            background: "var(--card-bg)",
            border: "2px solid var(--c2)",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 8px 20px rgba(0, 0, 0, 0.4)",
            zIndex: 100,
          }}
        >
          {suggestions.map((candidat) => (
            <div
              key={candidat.id}
              className="suggestion-item"
              onClick={() => handleSelect(candidat)}
              style={{
                padding: "15px 20px",
                cursor: "pointer",
                borderBottom: "1px solid rgba(219, 135, 143, 0.2)",
              }}
            >
              <div style={{ fontWeight: "700", color: "var(--c2)", marginBottom: "4px" }}>
                {candidat.nom}
              </div>
              {candidat.description && (
                <div style={{ fontSize: "0.9rem", color: "rgba(241, 235, 219, 0.7)" }}>
                  {candidat.description}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Aucun résultat */}
      {showSuggestions && query.length >= 2 && suggestions.length === 0 && !loading && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "8px",
            padding: "15px 20px",
            background: "var(--card-bg)",
            border: "2px solid var(--c1)",
            borderRadius: "12px",
            color: "rgba(241, 235, 219, 0.7)",
            textAlign: "center",
          }}
        >
          Aucune personnalité vivante trouvée
        </div>
      )}
    </div>
  );
}
