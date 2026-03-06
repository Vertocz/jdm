// app/joueur/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import CandidatCard from "@/app/components/CandidatCard";
import { pointsPourAge, calculAge } from "@/utils/fonctions";

export default function JoueurPage() {
  const params = useParams();
  const userId = params.id as string;

  const [profile, setProfile] = useState<any | null>(null);
  const [paris, setParis] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const doLoad = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { data: prof, error: profError } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle();

      if (profError) throw profError;
      if (!prof) { setLoading(false); return; }

      setProfile(prof);

      const { data, error: parisError } = await supabase
        .from("paris")
        .select(`
          id, mort, saison, candidat_id,
          candidats ( id, nom, ddn, ddd, description, photo )
        `)
        .eq("joueur", userId);

      if (parisError) throw parisError;

      const data_ = data ?? [];
      setParis(data_);

      const currentYear = new Date().getFullYear();
      const uniqueYears = [...new Set(data_.map((p: any) => p.saison) as number[])].sort((a, b) => b - a);
      if (!uniqueYears.includes(currentYear)) uniqueYears.unshift(currentYear);
      setYears(uniqueYears);
      setSelectedYear(currentYear);
    } catch (err: unknown) {
      console.error("[joueur]", err);
      setError("Impossible de charger ce profil. Vérifie ta connexion et réessaie.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { doLoad(); }, [doLoad]);

  if (loading) return <p>Chargement...</p>;

  if (error) return (
    <div style={{ maxWidth: 600, margin: "60px auto", textAlign: "center" }}>
      <p style={{ color: "var(--c2)", fontSize: "1.1rem", marginBottom: 20 }}>{error}</p>
      <button className="btn-primary" onClick={doLoad}>Réessayer</button>
    </div>
  );

  if (!profile) return <p>Joueur introuvable.</p>;

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

  const totalPoints = gagnants.reduce((sum, p: any) => {
    return sum + pointsPourAge(calculAge(p.candidats.ddn, p.candidats.ddd));
  }, 0);

  const coupDePoker = enCours.length > 0
    ? enCours.reduce((youngest: any, p: any) => {
        const a1 = calculAge(youngest.candidats.ddn, youngest.candidats.ddd) ?? 999;
        const a2 = calculAge(p.candidats.ddn, p.candidats.ddd) ?? 999;
        return a2 < a1 ? p : youngest;
      })
    : null;

  const moyenneAge = enCours.length > 0
    ? Math.round(enCours.reduce((sum: number, p: any) => sum + (calculAge(p.candidats.ddn, p.candidats.ddd) || 0), 0) / enCours.length)
    : 0;

  return (
    <div>
      <h1>Salle d'attente de {profile.display_name}</h1>

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

      <div className="year-buttons">
        {years.map((y) => (
          <button key={y} onClick={() => setSelectedYear(y)} className={`year-button ${y === selectedYear ? "active" : ""}`}>
            {y}
          </button>
        ))}
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
    </div>
  );
}