// app/in-memoriam/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CandidatCard from "@/app/components/CandidatCard";
import { Candidat } from "@/types";

export default function InMemoriam() {
  const [grouped, setGrouped] = useState<Record<number, Candidat[]>>({});
  const [years,   setYears]   = useState<number[]>([]);
  const [year,    setYear]    = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const doLoad = async () => {
    setError(null); setLoading(true);
    try {
      const { data, error: e } = await supabase
        .from("candidats")
        .select("*")
        .not("ddd", "is", null);
      if (e) throw e;

      const g: Record<number, Candidat[]> = {};
      (data ?? []).forEach((c: Candidat) => {
        const y = new Date(c.ddd!).getFullYear();
        if (!g[y]) g[y] = [];
        g[y].push(c);
      });

      const ly = Object.keys(g).map(Number).sort((a, b) => b - a);
      setGrouped(g); setYears(ly); setYear(ly[0] ?? null);
    } catch {
      setError("Impossible de charger les données.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { doLoad(); }, []);

  if (loading) return <div className="page-loading">Chargement…</div>;
  if (error)   return (
    <div className="page-error">
      <p>{error}</p>
      <button className="btn-retry" onClick={doLoad}>Réessayer</button>
    </div>
  );
  if (!year)   return (
    <div className="page-wrapper">
      <div className="page-container">
        <p className="empty-state">Aucun décès enregistré.</p>
      </div>
    </div>
  );

  const liste = grouped[year] ?? [];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>

      {/* ── EN-TÊTE ── */}
      <div style={{ padding: "48px 0 32px", textAlign: "center" }}>
        <h1 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: "clamp(2rem,5vw,3.2rem)",
          fontWeight: 900, lineHeight: 1,
          letterSpacing: "-1px",
          color: "var(--cream)",
          marginBottom: 6,
        }}>
          In Memoriam
        </h1>
        <p style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: ".65rem", fontWeight: 300,
          letterSpacing: "5px", textTransform: "uppercase",
          color: "rgba(200,175,90,.45)",
          marginBottom: 28,
        }}>
          Ils nous ont quittés
        </p>

        {/* Sélecteur d'années */}
        <div className="year-pills" style={{ marginBottom: 0 }}>
          {years.map(y => (
            <button
              key={y}
              onClick={() => setYear(y)}
              style={{
                padding: "7px 18px",
                borderRadius: 30,
                fontFamily: "'Outfit', sans-serif",
                fontSize: ".7rem", fontWeight: 500, letterSpacing: "1.5px",
                textTransform: "uppercase",
                border: y === year
                  ? "1px solid rgba(200,175,90,.7)"
                  : "1px solid rgba(241,235,219,.12)",
                background: y === year
                  ? "rgba(200,175,90,.15)"
                  : "transparent",
                color: y === year
                  ? "rgba(200,175,90,.9)"
                  : "rgba(241,235,219,.35)",
                cursor: "pointer",
                transition: "all .22s ease",
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* ── SÉPARATEUR ORNÉ ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        maxWidth: 500, margin: "24px auto 36px",
        padding: "0 24px",
      }}>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(200,175,90,.25))" }} />
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: ".6rem", color: "rgba(200,175,90,.4)", letterSpacing: "2px" }}>
          {liste.length} DISPARU{liste.length > 1 ? "S" : ""}
        </span>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(200,175,90,.25), transparent)" }} />
      </div>

      {/* ── GRILLE DE CARTES ── */}
      <div style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "0 24px",
        display: "flex",
        flexWrap: "wrap",
        gap: 20,
        justifyContent: "center",
      }}>
        {liste.map(c => (
          <CandidatCard key={c.id} candidat={c} showDescription={false} />
        ))}
      </div>
    </div>
  );
}