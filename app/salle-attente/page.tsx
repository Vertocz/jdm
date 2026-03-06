"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import CandidatCard from "@/app/components/CandidatCard";
import CandidatCardModal from "@/app/components/CandidatCardModal";
import { calculAge, pointsPourAge } from "@/utils/fonctions";
import { useSearchCandidats } from "@/app/hooks/useSearchCandidats";
import { useClickOutside } from "@/app/hooks/useClickOutside";

interface CandidatRecherche {
  id: string;
  nom: string;
  ddn: string;
  description: string;
  photo: string;
  wikidata_id: string;
}

export default function SalleAttente() {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [paris, setParis] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCandidat, setSelectedCandidat] = useState<CandidatRecherche | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const { suggestions, loading: searchLoading, showSuggestions, setShowSuggestions } = useSearchCandidats(searchQuery);
  useClickOutside(searchRef, () => setShowSuggestions(false));

  // loadParis isolé et wrappé — peut être appelé seul après ajout d'un candidat
  const loadParis = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("paris")
      .select(`
        id, mort, saison, candidat_id,
        candidats ( id, nom, ddn, ddd, description, photo, wikidata_id )
      `)
      .eq("joueur", userId);

    if (error) throw error;

    const data_ = data ?? [];
    setParis(data_);

    const currentYear = new Date().getFullYear();
    const uniqueYears = [...new Set(data_.map((p: any) => p.saison) as number[])].sort((a, b) => b - a);
    if (!uniqueYears.includes(currentYear)) uniqueYears.unshift(currentYear);
    setYears(uniqueYears);
    setSelectedYear(currentYear);
  }, []);

  const doInit = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (!u) return; // pas connecté → loading passe à false dans finally

      setUser(u);

      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", u.id)
        .maybeSingle();
      setProfile(prof);

      await loadParis(u.id);
    } catch (err: unknown) {
      console.error("[salle-attente]", err);
      setError("Impossible de charger ta salle d'attente. Vérifie ta connexion et réessaie.");
    } finally {
      // Toujours exécuté — jamais de loading infini
      setLoading(false);
    }
  }, [loadParis]);

  useEffect(() => { doInit(); }, [doInit]);

  const handleSelectCandidat = (candidat: CandidatRecherche) => {
    setSelectedCandidat(candidat);
    setShowSuggestions(false);
    setSearchQuery("");
  };

  const handleCandidatAdded = async () => {
    setSelectedCandidat(null);
    if (user) {
      try { await loadParis(user.id); }
      catch (err) { console.error("[salle-attente] reload après ajout:", err); }
    }
  };

  if (loading) return <p>Chargement...</p>;

  if (error) return (
    <div style={{ maxWidth: 600, margin: "60px auto", textAlign: "center" }}>
      <p style={{ color: "var(--c2)", fontSize: "1.1rem", marginBottom: 20 }}>{error}</p>
      <button className="btn-primary" onClick={doInit}>Réessayer</button>
    </div>
  );

  if (!user) return <p>Tu dois être connecté pour voir cette page.</p>;

  const parisForYear = paris.filter((p) => p.saison === selectedYear);

  const enCours = parisForYear.filter((p) => {
    const ddd = p.candidats?.ddd;
    if (!ddd) return true;
    return new Date(ddd).getFullYear() > selectedYear;
  });

  const gagnants = parisForYear.filter((p) => {
    const ddd = p.candidats?.ddd;
    if (!ddd) return false;
    return new Date(ddd).getFullYear() === selectedYear;
  });

  const totalPoints = gagnants.reduce((sum, p) => {
    return sum + pointsPourAge(calculAge(p.candidats.ddn, p.candidats.ddd));
  }, 0);

  const coupDePoker = enCours.length > 0
    ? enCours.reduce((youngest, p) => {
        const a1 = calculAge(youngest.candidats.ddn, youngest.candidats.ddd) ?? 999;
        const a2 = calculAge(p.candidats.ddn, p.candidats.ddd) ?? 999;
        return a2 < a1 ? p : youngest;
      })
    : null;

  const moyenneAge = enCours.length > 0
    ? Math.round(enCours.reduce((sum, p) => sum + (calculAge(p.candidats.ddn, p.candidats.ddd) || 0), 0) / enCours.length)
    : 0;

  return (
    <div>
      <h1>Ma salle d'attente</h1>

      <div className="year-buttons">
        {years.map((y) => (
          <button key={y} onClick={() => setSelectedYear(y)} className={`year-button ${y === selectedYear ? "active" : ""}`}>
            {y}
          </button>
        ))}
      </div>

      <div className="stats-container">
        <div className="stat-box">
          <div className="stat-value">{totalPoints}</div>
          <div className="stat-label">Point{totalPoints > 1 ? "s" : ""} en {selectedYear}</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{moyenneAge}</div>
          <div className="stat-label">Moyenne d'âge</div>
        </div>
        {coupDePoker && (
          <div className="stat-box stat-poker">
            <div className="stat-label">Coup de poker</div>
            <div className="stat-value" style={{ fontSize: "1.2rem" }}>{coupDePoker.candidats.nom}</div>
            <div className="stat-sublabel">{calculAge(coupDePoker.candidats.ddn, coupDePoker.candidats.ddd)} ans</div>
          </div>
        )}
      </div>

      {/* Barre de recherche */}
      <div ref={searchRef} style={{ position: "relative", marginBottom: "40px", marginTop: "30px" }}>
        <h2 style={{ marginBottom: "20px" }}>Ajouter un candidat</h2>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            placeholder="Rechercher une personnalité à ajouter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            onKeyDown={(e) => { if (e.key === "Enter" && suggestions.length > 0) handleSelectCandidat(suggestions[0]); }}
            style={{
              width: "100%", padding: "15px 20px", fontSize: "1.1rem",
              border: "2px solid var(--c1)", borderRadius: "12px",
              background: "rgba(78, 57, 41, 0.2)", color: "var(--text)",
              outline: "none", transition: "all 0.2s ease",
            }}
          />
          {searchLoading && (
            <div style={{ position: "absolute", right: "15px", top: "50%", transform: "translateY(-50%)", color: "var(--c2)" }}>
              Recherche...
            </div>
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="suggestions-list" style={{
            position: "absolute", top: "100%", left: 0, right: 0, marginTop: "8px",
            background: "var(--card-bg)", border: "2px solid var(--c2)", borderRadius: "12px",
            overflow: "hidden", boxShadow: "0 8px 20px rgba(0,0,0,0.4)", zIndex: 100,
          }}>
            {suggestions.map((candidat) => (
              <div key={candidat.id} onClick={() => handleSelectCandidat(candidat)}
                style={{ padding: "15px 20px", cursor: "pointer", borderBottom: "1px solid rgba(219,135,143,0.2)", transition: "background 0.2s ease" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(219,135,143,0.2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ fontWeight: "700", color: "var(--c2)", marginBottom: "4px" }}>{candidat.nom}</div>
                {candidat.description && <div style={{ fontSize: "0.9rem", color: "rgba(241,235,219,0.7)" }}>{candidat.description}</div>}
              </div>
            ))}
          </div>
        )}

        {showSuggestions && searchQuery.length >= 2 && suggestions.length === 0 && !searchLoading && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, marginTop: "8px",
            padding: "15px 20px", background: "var(--card-bg)", border: "2px solid var(--c1)",
            borderRadius: "12px", color: "rgba(241,235,219,0.7)", textAlign: "center",
          }}>
            Aucune personnalité vivante trouvée
          </div>
        )}
      </div>

      <h2>Paris en cours ({enCours.length}/10)</h2>
      {enCours.length === 0 && <p>Aucun pari en cours pour {selectedYear}.</p>}
      <div className="cards-grid">
        {enCours.map((p) => <CandidatCard key={p.id} candidat={p.candidats} />)}
      </div>

      <h2>Paris gagnants</h2>
      {gagnants.length === 0 && <p>Aucun pari gagnant en {selectedYear}.</p>}
      <div className="cards-grid">
        {gagnants.map((p) => <CandidatCard key={p.id} candidat={p.candidats} />)}
      </div>

      {selectedCandidat && (
        <CandidatCardModal
          candidat={selectedCandidat}
          onClose={() => setSelectedCandidat(null)}
          user={user}
          saison={selectedYear}
          parisEnCours={enCours.length}
          existingPariIds={parisForYear.map((p) => p.candidats?.wikidata_id).filter(Boolean)}
          onCandidatAdded={handleCandidatAdded}
        />
      )}
    </div>
  );
}