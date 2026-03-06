// app/salle-attente/page.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useSupabaseAuth } from "@/app/hooks/useSupabaseAuth";
import CandidatCard from "@/app/components/CandidatCard";
import CandidatCardModal from "@/app/components/CandidatCardModal";
import SearchBar from "@/app/components/SearchBar";
import { calculAge, pointsPourAge } from "@/utils/fonctions";
import { Pari, CandidatRecherche } from "@/types";

export default function SalleAttente() {
  // ── Auth via hook centralisé ───────────────────────────────────────────────
  const { user, loading: authLoading } = useSupabaseAuth();

  // ── État local ─────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<{ display_name: string } | null>(null);
  const [paris, setParis] = useState<Pari[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCandidat, setSelectedCandidat] = useState<CandidatRecherche | null>(null);

  // Garantit que selectedYear n'est initialisé qu'une seule fois,
  // même si loadParis est rappelé après l'ajout d'un candidat.
  const yearInitialized = useRef(false);

  // ── Chargement des paris ───────────────────────────────────────────────────
  const loadParis = useCallback(async (userId: string) => {
    const { data, error: fetchError } = await supabase
      .from("paris")
      .select(`
        id, mort, saison, candidat_id,
        candidats ( id, nom, ddn, ddd, description, photo, wikidata_id )
      `)
      .eq("joueur", userId);

    if (fetchError) throw fetchError;

    const data_ = (data ?? []) as unknown as Pari[];
    setParis(data_);

    const currentYear = new Date().getFullYear();
    const uniqueYears = [
      ...new Set(data_.map((p) => p.saison)),
    ].sort((a, b) => b - a);
    if (!uniqueYears.includes(currentYear)) uniqueYears.unshift(currentYear);
    setYears(uniqueYears);

    // N'initialiser l'année sélectionnée qu'au premier chargement
    if (!yearInitialized.current) {
      setSelectedYear(currentYear);
      yearInitialized.current = true;
    }
  }, []);

  // ── Initialisation ─────────────────────────────────────────────────────────
  const doInit = useCallback(async (userId: string) => {
    setError(null);
    setLoading(true);
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle();
      setProfile(prof);

      await loadParis(userId);
    } catch (err: unknown) {
      console.error("[salle-attente]", err);
      setError("Impossible de charger ta salle d'attente. Vérifie ta connexion et réessaie.");
    } finally {
      setLoading(false);
    }
  }, [loadParis]);

  useEffect(() => {
    if (!authLoading && user) {
      doInit(user.id);
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [authLoading, user, doInit]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCandidatAdded = async () => {
    setSelectedCandidat(null);
    if (user) {
      try {
        await loadParis(user.id);
      } catch (err) {
        console.error("[salle-attente] reload après ajout:", err);
      }
    }
  };

  // ── Rendu conditionnel ─────────────────────────────────────────────────────
  if (authLoading || loading) return <p>Chargement...</p>;

  if (error) return (
    <div style={{ maxWidth: 600, margin: "60px auto", textAlign: "center" }}>
      <p style={{ color: "var(--c2)", fontSize: "1.1rem", marginBottom: 20 }}>{error}</p>
      <button className="btn-primary" onClick={() => user && doInit(user.id)}>Réessayer</button>
    </div>
  );

  if (!user) return <p>Tu dois être connecté pour voir cette page.</p>;

  // ── Calculs dérivés ────────────────────────────────────────────────────────
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

  // Calcul des âges une seule fois pour éviter les appels répétés
  const enCoursAvecAge = enCours.map((p) => ({
    ...p,
    age: calculAge(p.candidats.ddn, p.candidats.ddd),
  }));

  const totalPoints = gagnants.reduce((sum, p) => {
    return sum + pointsPourAge(calculAge(p.candidats.ddn, p.candidats.ddd));
  }, 0);

  const coupDePoker = enCoursAvecAge.length > 0
    ? enCoursAvecAge.reduce((youngest, p) => {
        const a1 = youngest.age ?? 999;
        const a2 = p.age ?? 999;
        return a2 < a1 ? p : youngest;
      })
    : null;

  const moyenneAge = enCoursAvecAge.length > 0
    ? Math.round(enCoursAvecAge.reduce((sum, p) => sum + (p.age ?? 0), 0) / enCoursAvecAge.length)
    : 0;

  const existingWikidataIds = parisForYear
    .map((p) => p.candidats?.wikidata_id)
    .filter(Boolean) as string[];

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <div>
      <h1>Ma salle d'attente</h1>

      <div className="year-buttons">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setSelectedYear(y)}
            className={`year-button ${y === selectedYear ? "active" : ""}`}
          >
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
            <div className="stat-value" style={{ fontSize: "1.2rem" }}>
              {coupDePoker.candidats.nom}
            </div>
            <div className="stat-sublabel">{coupDePoker.age} ans</div>
          </div>
        )}
      </div>

      {/* Barre de recherche */}
      <div style={{ marginBottom: "40px", marginTop: "30px" }}>
        <h2 style={{ marginBottom: "20px" }}>Ajouter un candidat</h2>
        <SearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onSelect={setSelectedCandidat}
          placeholder="Rechercher une personnalité à ajouter..."
          borderColor="var(--c2)"
        />
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
          existingPariIds={existingWikidataIds}
          onCandidatAdded={handleCandidatAdded}
        />
      )}
    </div>
  );
}
