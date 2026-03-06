// app/page.tsx
"use client";

import { useState } from "react";
import CandidatCardModal from "./components/CandidatCardModal";
import SearchBar from "./components/SearchBar";
import { useSupabaseAuth } from "./hooks/useSupabaseAuth";
import { CandidatRecherche } from "@/types";

export default function Home() {
  const { user } = useSupabaseAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCandidat, setSelectedCandidat] = useState<CandidatRecherche | null>(null);

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
      <div style={{ marginBottom: "40px" }}>
        <h2 style={{ marginBottom: "20px" }}>Découvrir des candidats</h2>
        <SearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onSelect={setSelectedCandidat}
          placeholder="Rechercher une personnalité vivante..."
        />
      </div>

      {/* Barème de points */}
      <div
        style={{
          background: "rgba(78, 57, 41, 0.7)",
          padding: "0px 20px",
          borderRadius: "15px",
          border: "3px solid var(--text)",
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
