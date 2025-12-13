"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CandidatCard from "@/app/components/CandidatCard";

export default function Favoris() {
  const [loading, setLoading] = useState(true);
  const [topAllTime, setTopAllTime] = useState<any[]>([]);
  const [topCurrentYear, setTopCurrentYear] = useState<any[]>([]);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const load = async () => {
      const { data: paris, error } = await supabase.from("paris").select("*");

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      // Hall of Fame : tous les paris
      const groupedAll: Record<number, number> = {};
      paris.forEach((p) => {
        groupedAll[p.candidat_id] = (groupedAll[p.candidat_id] || 0) + 1;
      });

      const topAll = Object.entries(groupedAll)
        .map(([id, votes]) => ({
          candidat_id: Number(id),
          totalVotes: votes as number,
        }))
        .sort((a, b) => b.totalVotes - a.totalVotes)
        .slice(0, 3);

      const allIds = topAll.map((e) => e.candidat_id);
      const { data: candidatsAll } = await supabase
        .from("candidats")
        .select("*")
        .in("id", allIds);

      const mapAll: Record<number, any> = {};
      candidatsAll?.forEach((c) => (mapAll[c.id] = c));

      setTopAllTime(
        topAll.map((e) => ({
          ...e,
          candidat: mapAll[e.candidat_id],
        }))
      );

      // Favoris de l'année en cours
      const parisYear = paris.filter((p) => p.saison === currentYear);
      const groupedYear: Record<number, number> = {};
      parisYear.forEach((p) => {
        groupedYear[p.candidat_id] = (groupedYear[p.candidat_id] || 0) + 1;
      });

      const eligibleCandidates = Object.entries(groupedYear)
        .filter(([_, votes]) => votes >= 3)
        .map(([id, votes]) => ({
          candidat_id: Number(id),
          totalVotes: votes as number,
        }));

      if (eligibleCandidates.length > 0) {
        const topYear = eligibleCandidates
          .sort((a, b) => b.totalVotes - a.totalVotes)
          .slice(0, 3);

        const yearIds = topYear.map((e) => e.candidat_id);
        const { data: candidatsYear } = await supabase
          .from("candidats")
          .select("*")
          .in("id", yearIds);

        const mapYear: Record<number, any> = {};
        candidatsYear?.forEach((c) => (mapYear[c.id] = c));

        setTopCurrentYear(
          topYear.map((e) => ({
            ...e,
            candidat: mapYear[e.candidat_id],
          }))
        );
      } else {
        setTopCurrentYear([]);
      }

      setLoading(false);
    };

    load();
  }, []);

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <h1>Hall of Fame</h1>
      <p style={{ marginBottom: "30px" }}>
        Les candidats les plus pariés de tous les temps
      </p>

      <div className="cards-grid-centered">
        {topAllTime.map(({ candidat, totalVotes }, index) => (
          <div key={candidat.id} style={{ position: "relative", width: "280px" }}>
            <div
              style={{
                position: "absolute",
                top: "-10px",
                left: "-10px",
                background: "var(--c2)",
                color: "var(--fond)",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "700",
                fontSize: "1.2rem",
                zIndex: 10,
                border: "3px solid var(--fond)",
              }}
            >
              #{index + 1}
            </div>
            <CandidatCard candidat={candidat} showDescription={false} />
            <p style={{ marginTop: "10px", fontWeight: "700", color: "var(--c2)" }}>
              {totalVotes} pari{totalVotes > 1 ? "s" : ""} au total
            </p>
          </div>
        ))}
      </div>

      {topCurrentYear.length >= 3 && (
        <>
          <h1 style={{ marginTop: "60px" }}>Favoris {currentYear}</h1>
          <p style={{ marginBottom: "30px" }}>
            Les candidats les plus pariés cette année (minimum 3 paris)
          </p>

          <div className="cards-grid-centered">
            {topCurrentYear.map(({ candidat, totalVotes }, index) => (
              <div key={candidat.id} style={{ position: "relative", width: "280px" }}>
                <div
                  style={{
                    position: "absolute",
                    top: "-10px",
                    left: "-10px",
                    background: "var(--c2)",
                    color: "var(--fond)",
                    borderRadius: "50%",
                    width: "40px",
                    height: "40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "700",
                    fontSize: "1.2rem",
                    zIndex: 10,
                    border: "3px solid var(--fond)",
                  }}
                >
                  #{index + 1}
                </div>
                <CandidatCard candidat={candidat} showDescription={false} />
                <p style={{ marginTop: "10px", fontWeight: "700", color: "var(--c2)" }}>
                  {totalVotes} pari{totalVotes > 1 ? "s" : ""} cette année
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}