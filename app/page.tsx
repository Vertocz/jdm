// app/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import CandidatCardModal from "./components/CandidatCardModal";

interface CandidatRecherche {
  id: string;
  nom: string;
  ddn: string;
  description: string;
  photo: string;
  wikidata_id: string;
}

export default function Home() {
  const [user, setUser] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CandidatRecherche[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCandidat, setSelectedCandidat] = useState<CandidatRecherche | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    load();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  // Fermer les suggestions si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Recherche avec debounce
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/recherche?q=${encodeURIComponent(searchQuery)}`
        );
        const data = await response.json();
        setSuggestions(data.candidats || []);
        setShowSuggestions(true);
      } catch (error) {
        console.error("Erreur recherche:", error);
        setSuggestions([]);
      }
      setLoading(false);
    }, 500); // Attendre 500ms après la dernière frappe

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectCandidat = (candidat: CandidatRecherche) => {
    setSelectedCandidat(candidat);
    setShowSuggestions(false);
    setSearchQuery("");
  };

  return (
    <section style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      <h1>Le Jeu de la Mort</h1>

      <div className="home-intro" style={{ marginBottom: "40px" }}>
        <p style={{ lineHeight: "2", fontSize: "1.1rem" }}>
          Le <span style={{ color: "var(--c2)", fontWeight: "700" }}>Jeu de la Mort</span> a
          pour fonction d'expier les sentiments douloureux par le mauvais goût.
          <br />
          Le principe est simple : nommer des personnalités qui passeront l'arme à gauche dans
          l'année.
          <br />
          Chaque joueur désigne 10 candidats à la mort pour l'année civile en cours.
          <br />
          Lors du décès d'un candidat, le joueur l'ayant désigné peut sélectionner en
          remplacement une nouvelle personne.
          <br />
          Le nombre de points que rapporte le décès d'un candidat est indexé sur son âge au
          moment de son décès.
        </p>
      </div>

      {/* Barre de recherche */}
      <div
        ref={searchRef}
        style={{
          position: "relative",
          marginBottom: "40px",
        }}
      >
        <h2 style={{ marginBottom: "20px" }}>Découvrir des candidats</h2>

        <div style={{ position: "relative" }}>
          <input
            type="text"
            placeholder="Rechercher une personnalité vivante..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            style={{
              width: "100%",
              padding: "15px 20px",
              fontSize: "1.1rem",
              border: "2px solid var(--c1)",
              borderRadius: "12px",
              background: "rgba(78, 57, 41, 0.2)",
              color: "var(--text)",
              fontFamily: "Quicksand, sans-serif",
              outline: "none",
              transition: "all 0.2s ease",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && suggestions.length > 0) {
                handleSelectCandidat(suggestions[0]);
              }
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

        {/* Suggestions */}
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
                onClick={() => handleSelectCandidat(candidat)}
                style={{
                  padding: "15px 20px",
                  cursor: "pointer",
                  borderBottom: "1px solid rgba(219, 135, 143, 0.2)",
                  transition: "background 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(219, 135, 143, 0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
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

        {showSuggestions && searchQuery.length >= 2 && suggestions.length === 0 && !loading && (
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

      {/* Informations supplémentaires */}
      <div
        style={{
          background: "rgba(78, 57, 41, 0.7)",
          padding: "0px 20px",
          borderRadius: "15px",
          border: "3px solid var(--c1)",
        }}
      >
        <h3 style={{ color: "var(--c2)", marginBottom: "15px" }}>Barème de points</h3>
        <ul style={{ textAlign: "left", lineHeight: "1.8", paddingLeft: "20px" }}>
          <li>Moins de 55 ans : <strong>10 points</strong></li>
          <li>55-65 ans : <strong>9 points</strong></li>
          <li>65-75 ans : <strong>8 points</strong></li>
          <li>75-80 ans : <strong>7 points</strong></li>
          <li>80-85 ans : <strong>5 points</strong></li>
          <li>85-90 ans : <strong>3 points</strong></li>
          <li>Plus de 90 ans : <strong>1 point</strong></li>
        </ul>
      </div>

      {/* Modal avec carte candidat */}
      {selectedCandidat && (
        <CandidatCardModal
          candidat={selectedCandidat}
          onClose={() => setSelectedCandidat(null)}
          user={user}
        />
      )}
    </section>
  );
}