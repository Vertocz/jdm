// app/joueur/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    const init = async () => {
      // Charger le profil
      const { data: prof, error: profError } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle();

      if (profError || !prof) {
        console.error("Joueur introuvable");
        setLoading(false);
        return;
      }

      setProfile(prof);

      // Charger les paris
      const { data, error } = await supabase
        .from("paris")
        .select(`
          id,
          mort,
          saison,
          candidat_id,
          candidats (
            id,
            nom,
            ddn,
            ddd,
            description,
            photo
          )
        `)
        .eq("joueur", userId);

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      setParis(data || []);

      const uniqueYears = [...new Set(data.map((p: any) => p.saison))].sort(
        (a, b) => b - a
      );

      if (uniqueYears.includes(new Date().getFullYear())) {
        setSelectedYear(new Date().getFullYear());
      } else {
        setSelectedYear(uniqueYears[0] ?? new Date().getFullYear());
      }

      setYears(uniqueYears);
      setLoading(false);
    };

    init();
  }, [userId]);

  if (loading) return <p>Chargement...</p>;

  if (!profile) return <p>Joueur introuvable.</p>;

  const parisForYear = paris.filter((p) => p.saison === selectedYear);

  const enCours = parisForYear.filter((p) => {
    const ddd = p.candidats.ddd;
    if (!ddd) return true;
    const anneeDDD = new Date(ddd).getFullYear();
    return anneeDDD > selectedYear;
  });

  const gagnants = parisForYear.filter((p) => {
    const ddd = p.candidats.ddd;
    if (!ddd) return false;
    const anneeDDD = new Date(ddd).getFullYear();
    return anneeDDD === selectedYear;
  });

  // Calculer les points totaux de l'année
  const totalPoints = gagnants.reduce((sum, p: any) => {
    const age = calculAge(p.candidats.ddn, p.candidats.ddd);
    return sum + pointsPourAge(age);
  }, 0);

  // Trouver le coup de poker (candidat le plus jeune en cours)
  const coupDePoker = enCours.length > 0
    ? enCours.reduce((youngest: any, p: any) => {
        const ageYoungest = calculAge(youngest.candidats.ddn, youngest.candidats.ddd) ?? 999;
        const ageCurrent = calculAge(p.candidats.ddn, p.candidats.ddd) ?? 999;
        return ageCurrent < ageYoungest ? p : youngest;
      })
    : null;

  // Calculer la moyenne d'âge des candidats en cours
  const moyenneAge = enCours.length > 0
    ? Math.round(
        enCours.reduce((sum: number, p: any) => {
          const age = calculAge(p.candidats.ddn, p.candidats.ddd);
          return sum + (age || 0);
        }, 0) / enCours.length
      )
    : 0;

  return (
    <div>
      <h1>Salle d'attente de {profile.display_name}</h1>

      {/* Stats de l'année */}
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
            <div className="stat-sublabel">
              {calculAge(coupDePoker.candidats.ddn, coupDePoker.candidats.ddd)} ans
            </div>
          </div>
        )}
      </div>

      <div className="year-buttons">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setSelectedYear(y)}
            className={`year-button ${y === selectedYear ? 'active' : ''}`}
          >
            {y}
          </button>
        ))}
      </div>

      <h2>Paris en cours ({selectedYear})</h2>
      {enCours.length === 0 && <p>Aucun pari en cours pour {selectedYear}.</p>}
      <div className="cards-grid">
        {enCours.map((p) => (
          <CandidatCard key={p.id} candidat={p.candidats} />
        ))}
      </div>

      <h2>Paris gagnants ({selectedYear})</h2>
      {gagnants.length === 0 && <p>Aucun pari gagnant en {selectedYear}.</p>}
      <div className="cards-grid">
        {gagnants.map((p) => (
          <CandidatCard key={p.id} candidat={p.candidats} />
        ))}
      </div>
    </div>
  );
}