// app/classement/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { pointsPourAge, calculAge } from "@/utils/fonctions";
import Link from "next/link";

interface JoueurScore {
  user_id: string;
  display_name: string;
  totalPoints: number;
  parisGagnants: number;
}

export default function Classement() {
  const [classementParAnnee, setClassementParAnnee] = useState<Record<number, JoueurScore[]>>({});
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // 1. Récupérer tous les profils
      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("user_id, display_name");

      if (profError) {
        console.error(profError);
        setLoading(false);
        return;
      }

      // 2. Récupérer tous les paris avec candidats
      const { data: paris, error: parisError } = await supabase
        .from("paris")
        .select(`
          id,
          joueur,
          saison,
          candidat_id,
          candidats (
            id,
            nom,
            ddn,
            ddd
          )
        `);

      if (parisError) {
        console.error(parisError);
        setLoading(false);
        return;
      }

      // 3. Regrouper les paris par année
      const parisParAnnee: Record<number, any[]> = {};
      const anneesSet = new Set<number>();

      paris.forEach((p: any) => {
        anneesSet.add(p.saison);
        if (!parisParAnnee[p.saison]) {
          parisParAnnee[p.saison] = [];
        }
        parisParAnnee[p.saison].push(p);
      });

      const listAnnees = Array.from(anneesSet).sort((a, b) => b - a);

      // 4. Calculer le classement pour chaque année
      const classements: Record<number, JoueurScore[]> = {};

      listAnnees.forEach((annee) => {
        const scoresMap: Record<string, { points: number; wins: number }> = {};

        parisParAnnee[annee].forEach((p: any) => {
          const candidat = p.candidats;
          if (!candidat.ddd) return;

          const anneeDeces = new Date(candidat.ddd).getFullYear();

          // Le pari est gagnant si le décès a eu lieu l'année du pari
          if (anneeDeces === annee) {
            const age = calculAge(candidat.ddn, candidat.ddd);
            const points = pointsPourAge(age);

            if (!scoresMap[p.joueur]) {
              scoresMap[p.joueur] = { points: 0, wins: 0 };
            }

            scoresMap[p.joueur].points += points;
            scoresMap[p.joueur].wins += 1;
          }
        });

        // Construire le classement pour cette année
        // On récupère tous les joueurs qui ont parié cette année-là
        const joueursAnnee = new Set(parisParAnnee[annee].map((p: any) => p.joueur));
        
        const resultat: JoueurScore[] = profiles
          .filter((prof) => joueursAnnee.has(prof.user_id)) // Seulement ceux qui ont parié cette année
          .map((prof) => {
            const score = scoresMap[prof.user_id] || { points: 0, wins: 0 };
            return {
              user_id: prof.user_id,
              display_name: prof.display_name || "Joueur inconnu",
              totalPoints: score.points,
              parisGagnants: score.wins,
            };
          })

        // Trier par points décroissants
        resultat.sort((a, b) => {
          if (b.totalPoints !== a.totalPoints) {
            return b.totalPoints - a.totalPoints;
          }
          return b.parisGagnants - a.parisGagnants;
        });

        classements[annee] = resultat;
      });

      setClassementParAnnee(classements);
      setYears(listAnnees);
      setSelectedYear(listAnnees[0] ?? null);
      setLoading(false);
    };

    load();
  }, []);

  if (loading) return <p>Chargement du classement...</p>;

  if (!selectedYear) return <p>Aucun classement disponible.</p>;

  const classement = classementParAnnee[selectedYear] || [];

  return (
    <div>
      <h1>Classement</h1>

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

      <h2>Saison {selectedYear}</h2>

      {classement.length === 0 && (
        <p>Aucun joueur n'a marqué de points en {selectedYear}.</p>
      )}

      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        {classement.map((joueur, index) => {
          const rank = index + 1;
          const medal =
            rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";

          return (
            <div key={joueur.user_id} className="classement-item">
              <div className="classement-rank">
                {medal || `#${rank}`}
              </div>

              <div className="classement-info">
                <Link
                  href={`/joueur/${joueur.user_id}`}
                  className="no-underline"
                  style={{
                    fontSize: "1.3rem",
                    fontWeight: "700",
                    color: "var(--c2)",
                  }}
                >
                  {joueur.display_name}
                </Link>
                <div style={{ fontSize: "0.9rem", marginTop: "5px" }}>
                  {joueur.parisGagnants} pari{joueur.parisGagnants > 1 ? "s" : ""} gagnant{joueur.parisGagnants > 1 ? "s" : ""}
                </div>
              </div>

              <div className="classement-score">
                {joueur.totalPoints}
                <div style={{ fontSize: "0.8rem", fontWeight: "500" }}>
                  point{joueur.totalPoints > 1 ? "s" : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}