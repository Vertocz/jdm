"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CandidatCard from "@/app/components/CandidatCard";

export default function InMemoriam() {
  const [grouped, setGrouped] = useState<any>({});
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: candidats, error } = await supabase
        .from("candidats")
        .select("*")
        .not("ddd", "is", null);

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      const sorted = [...candidats].sort(
        (a, b) =>
          new Date(b.ddd).getFullYear() - new Date(a.ddd).getFullYear()
      );

      const g: any = {};
      sorted.forEach((c) => {
        const year = new Date(c.ddd).getFullYear();
        if (!g[year]) g[year] = [];
        g[year].push(c);
      });

      const listYears = Object.keys(g).map(Number).sort((a, b) => b - a);

      setGrouped(g);
      setYears(listYears);
      setSelectedYear(listYears[0] ?? null);
      setLoading(false);
    };

    load();
  }, []);

  if (loading) return <p>Chargement...</p>;

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
            className={`year-button ${y === selectedYear ? 'active' : ''}`}
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