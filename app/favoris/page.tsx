"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CandidatCard from "@/app/components/CandidatCard";

export default function Favoris() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topAllTime, setTopAllTime] = useState<any[]>([]);
  const [topCurrentYear, setTopCurrentYear] = useState<any[]>([]);
  const currentYear = new Date().getFullYear();

  const doLoad = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data: paris, error } = await supabase.from("paris").select("*");
      if (error) throw error;

      // Hall of Fame : tous les paris
      const groupedAll: Record<number, number> = {};
      (paris ?? []).forEach((p) => {
        groupedAll[p.candidat_id] = (groupedAll[p.candidat_id] || 0) + 1;
      });

      const topAll = Object.entries(groupedAll)
        .map(([id, votes]) => ({ candidat_id: Number(id), totalVotes: votes as number }))
        .sort((a, b) => b.totalVotes - a.totalVotes)
        .slice(0, 3);

      if (topAll.length > 0) {
        const { data: candidatsAll } = await supabase
          .from("candidats")
          .select("*")
          .in("id", topAll.map((e) => e.candidat_id));
        const mapAll: Record<number, any> = {};
        (candidatsAll ?? []).forEach((c) => (mapAll[c.id] = c));
        setTopAllTime(topAll.map((e) => ({ ...e, candidat: mapAll[e.candidat_id] })));
      }

      // Favoris de l'année en cours (min 3 paris)
      const parisYear = (paris ?? []).filter((p) => p.saison === currentYear);
      const groupedYear: Record<number, number> = {};
      parisYear.forEach((p) => {
        groupedYear[p.candidat_id] = (groupedYear[p.candidat_id] || 0) + 1;
      });

      const eligible = Object.entries(groupedYear)
        .filter(([, votes]) => votes >= 3)
        .map(([id, votes]) => ({ candidat_id: Number(id), totalVotes: votes as number }))
        .sort((a, b) => b.totalVotes - a.totalVotes)
        .slice(0, 3);

      if (eligible.length > 0) {
        const { data: candidatsYear } = await supabase
          .from("candidats")
          .select("*")
          .in("id", eligible.map((e) => e.candidat_id));
        const mapYear: Record<number, any> = {};
        (candidatsYear ?? []).forEach((c) => (mapYear[c.id] = c));
        setTopCurrentYear(eligible.map((e) => ({ ...e, candidat: mapYear[e.candidat_id] })));
      } else {
        setTopCurrentYear([]);
      }
    } catch (err: unknown) {
      console.error("[favoris]", err);
      setError("Impossible de charger les favoris. Vérifie ta connexion et réessaie.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { doLoad(); }, []);

  if (loading) return <p>Chargement...</p>;

  if (error) return (
    <div style={{ maxWidth: 600, margin: "60px auto", textAlign: "center" }}>
      <p style={{ color: "var(--c2)", fontSize: "1.1rem", marginBottom: 20 }}>{error}</p>
      <button className="btn-primary" onClick={doLoad}>Réessayer</button>
    </div>
  );

  return (
    <div>
      <h1>Hall of Fame</h1>
      <p style={{ marginBottom: "30px" }}>Les candidats les plus pariés de tous les temps</p>

      <div className="cards-grid-centered">
        {topAllTime.map(({ candidat, totalVotes }, index) => (
          <div key={candidat.id} style={{ position: "relative", width: "280px" }}>
            <div style={{
              position: "absolute", top: "-10px", left: "-10px",
              background: "var(--c2)", color: "var(--fond)", borderRadius: "50%",
              width: "40px", height: "40px", display: "flex", alignItems: "center",
              justifyContent: "center", fontWeight: "700", fontSize: "1.2rem",
              zIndex: 10, border: "3px solid var(--fond)",
            }}>
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
                <div style={{
                  position: "absolute", top: "-10px", left: "-10px",
                  background: "var(--c2)", color: "var(--fond)", borderRadius: "50%",
                  width: "40px", height: "40px", display: "flex", alignItems: "center",
                  justifyContent: "center", fontWeight: "700", fontSize: "1.2rem",
                  zIndex: 10, border: "3px solid var(--fond)",
                }}>
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