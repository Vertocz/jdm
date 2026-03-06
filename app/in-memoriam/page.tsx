"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CandidatCard from "@/app/components/CandidatCard";

export default function InMemoriam() {
  const [grouped, setGrouped] = useState<Record<number, any[]>>({});
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const doLoad = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data: candidats, error } = await supabase
        .from("candidats")
        .select("*")
        .not("ddd", "is", null);

      if (error) throw error;

      const g: Record<number, any[]> = {};
      (candidats ?? []).forEach((c) => {
        const year = new Date(c.ddd).getFullYear();
        if (!g[year]) g[year] = [];
        g[year].push(c);
      });

      const listYears = Object.keys(g).map(Number).sort((a, b) => b - a);
      setGrouped(g);
      setYears(listYears);
      setSelectedYear(listYears[0] ?? null);
    } catch (err: unknown) {
      console.error("[in-memoriam]", err);
      setError("Impossible de charger les données. Vérifie ta connexion et réessaie.");
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

  if (!selectedYear) return <p>Aucun décès enregistré.</p>;

  const liste = grouped[selectedYear] ?? [];

  return (
    <div>
      <h1>In Memoriam</h1>

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

      <h2>Décès en {selectedYear}</h2>

      <div className="cards-grid">
        {liste.map((cand: any) => (
          <CandidatCard key={cand.id} candidat={cand} />
        ))}
      </div>
    </div>
  );
}