// app/components/SearchBar.tsx
"use client";

import { useRef } from "react";
import { useSearchCandidats } from "@/app/hooks/useSearchCandidats";
import { useClickOutside } from "@/app/hooks/useClickOutside";
import { CandidatRecherche } from "@/types";
import { calculAge, pointsPourAge } from "@/utils/fonctions";

interface SearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (candidat: CandidatRecherche) => void;
  placeholder?: string;
}

export default function SearchBar({ query, onQueryChange, onSelect, placeholder = "Rechercher une personnalité…" }: SearchBarProps) {
  const searchRef = useRef<HTMLDivElement>(null);
  const { suggestions, loading, showSuggestions, setShowSuggestions } = useSearchCandidats(query);

  useClickOutside(searchRef, () => setShowSuggestions(false));

  const handleSelect = (c: CandidatRecherche) => {
    onSelect(c);
    setShowSuggestions(false);
    onQueryChange("");
  };

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          onKeyDown={e => { if (e.key === "Enter" && suggestions.length > 0) handleSelect(suggestions[0]); }}
          placeholder={placeholder}
          className="w-full px-5 py-4 bg-[#F1EBDB]/[0.05] border border-[#F1EBDB]/15 rounded-2xl text-[#F1EBDB] text-[0.95rem] font-['Outfit'] outline-none focus:border-[#db878f]/50 focus:bg-[#F1EBDB]/[0.07] focus:shadow-[0_0_0_3px_rgba(219,135,143,.07)] placeholder:text-[#F1EBDB]/28 transition-all"
        />
        {loading
          ? <span className="search-spinner" />
          : <span className="absolute right-[18px] top-1/2 -translate-y-1/2 text-[#F1EBDB]/28 text-base pointer-events-none">⌕</span>
        }
      </div>

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-[#0f0d1e]/97 border border-[#db878f]/20 rounded-[18px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,.65)] z-[100] max-h-[400px] overflow-y-auto">
          {suggestions.map(c => {
            const age = calculAge(c.ddn, null);
            const pts = pointsPourAge(age);
            return (
              <div
                key={c.id}
                onClick={() => handleSelect(c)}
                className="flex items-center gap-3.5 px-[18px] py-3.5 border-b border-[#F1EBDB]/[0.05] last:border-0 cursor-pointer hover:bg-[#db878f]/[0.07] transition-colors"
              >
                <div className="w-11 h-[52px] rounded-[7px] bg-gradient-to-br from-[#db878f]/12 to-[#4e2837]/25 flex-shrink-0 flex items-center justify-center text-[#db878f]/25 text-xl">
                  {c.photo
                    ? <img src={`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(c.photo.replace(/ /g,"_"))}`}
                        alt="" loading="lazy"
                        className="w-full h-full object-cover object-top rounded-[7px]"
                        onError={e => { (e.target as HTMLImageElement).parentElement!.innerHTML = "◆"; }}
                      />
                    : "◆"
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#F1EBDB] text-[0.88rem] truncate">{c.nom}</div>
                  {c.description && <div className="text-[#F1EBDB]/35 text-[0.67rem] truncate mt-0.5">{c.description}</div>}
                  <div className="flex items-center gap-2 mt-1">
                    {age !== null && <span className="text-[#db878f]/50 text-[0.62rem]">{age} ans</span>}
                    <span className="text-[#db878f] text-[0.62rem] font-bold bg-[#db878f]/10 rounded-[10px] px-1.5 py-0.5">{pts} pt{pts > 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Aucun résultat */}
      {showSuggestions && query.length >= 2 && suggestions.length === 0 && !loading && (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-[#0f0d1e]/97 border border-[#F1EBDB]/[0.08] rounded-[18px] px-5 py-5 text-[#F1EBDB]/28 text-center text-[0.76rem] tracking-wider z-[100]">
          Aucune personnalité vivante trouvée
        </div>
      )}
    </div>
  );
}