// app/in-memoriam/page.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import CandidatCard from "@/app/components/CandidatCard";
import { Candidat } from "@/types";

/* ── Carrousel ─────────────────────────────────────────────────────────────
   - Une seule carte visible à la fois, centrée
   - Rotation automatique toutes les INTERVAL ms
   - Pause au survol souris ou toucher mobile
   - Navigation par flèches ou points
   - Transition slide smooth
────────────────────────────────────────────────────────────────────────── */
const INTERVAL = 3500; // ms entre chaque carte

function Carousel({ items }: { items: Candidat[] }) {
  const [idx,       setIdx]       = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [animating, setAnimating] = useState(false);
  const pausedRef   = useRef(false);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback((newIdx: number, dir: "next" | "prev") => {
    if (animating || items.length <= 1) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setIdx(newIdx);
      setAnimating(false);
    }, 380);
  }, [animating, items.length]);

  const next = useCallback(() => go((idx + 1) % items.length, "next"), [go, idx, items.length]);
  const prev = useCallback(() => go((idx - 1 + items.length) % items.length, "prev"), [go, idx, items.length]);

  // Auto-rotation
  useEffect(() => {
    if (items.length <= 1) return;
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) next();
    }, INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [next, items.length]);

  // Reset idx quand les items changent (changement d'année)
  useEffect(() => { setIdx(0); }, [items]);

  if (items.length === 0) return null;

  // Slide : entrant arrive de droite (next) ou gauche (prev), sortant part à gauche (next) ou droite (prev)
  const enterFrom = direction === "next" ? "translateX(60px)" : "translateX(-60px)";

  return (
    <div
      style={{ position: "relative", userSelect: "none" }}
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onTouchStart={() => { pausedRef.current = true; }}
      onTouchEnd={() => { setTimeout(() => { pausedRef.current = false; }, 2000); }}
    >
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: ${enterFrom} scale(.95); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes slideOut {
          from { opacity: 1; transform: translateX(0) scale(1); }
          to   { opacity: 0; transform: ${direction === "next" ? "translateX(-60px)" : "translateX(60px)"} scale(.95); }
        }
      `}</style>

      {/* Carte */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: 320,
        position: "relative",
      }}>
        <div
          key={`${idx}-${animating}`}
          style={{
            animation: animating ? "slideOut .38s ease forwards" : "slideIn .38s ease forwards",
          }}
        >
          <CandidatCard candidat={items[idx]} showDescription={false} />
        </div>
      </div>

      {/* Nom + description sous la carte */}
      <div style={{ textAlign: "center", marginTop: 16, padding: "0 24px", minHeight: 48 }}>
        {items[idx].description && (
          <p style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: ".78rem", fontWeight: 300,
            color: "rgba(200,175,90,.5)",
            fontStyle: "italic",
            lineHeight: 1.6,
            maxWidth: 340,
            margin: "0 auto",
          }}>
            {items[idx].description.charAt(0).toUpperCase() + items[idx].description.slice(1)}
          </p>
        )}
      </div>

      {/* Flèches + points — seulement si > 1 carte */}
      {items.length > 1 && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          marginTop: 24,
        }}>
          {/* Flèche précédent */}
          <button onClick={prev} style={btnStyle}>
            ←
          </button>

          {/* Points de navigation */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i, i > idx ? "next" : "prev")}
                style={{
                  width: i === idx ? 20 : 6,
                  height: 6, borderRadius: 3,
                  background: i === idx ? "rgba(200,175,90,.8)" : "rgba(241,235,219,.2)",
                  border: "none", cursor: "pointer", padding: 0,
                  transition: "all .3s ease",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>

          {/* Flèche suivant */}
          <button onClick={next} style={btnStyle}>
            →
          </button>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: 36, height: 36,
  borderRadius: "50%",
  border: "1px solid rgba(200,175,90,.25)",
  background: "rgba(200,175,90,.06)",
  color: "rgba(200,175,90,.6)",
  fontFamily: "'Outfit', sans-serif",
  fontSize: "1rem",
  cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  transition: "all .2s ease",
  flexShrink: 0,
};

/* ── Page principale ────────────────────────────────────────────────────── */
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
        .from("candidats").select("*").not("ddd", "is", null);
      if (e) throw e;

      const g: Record<number, Candidat[]> = {};
      (data ?? []).forEach((c: Candidat) => {
        const y = new Date(c.ddd!).getFullYear();
        if (!g[y]) g[y] = [];
        g[y].push(c);
      });

      const ly = Object.keys(g).map(Number).sort((a, b) => b - a);
      setGrouped(g); setYears(ly); setYear(ly[0] ?? null);
    } catch { setError("Impossible de charger les données."); }
    finally  { setLoading(false); }
  };

  useEffect(() => { doLoad(); }, []);

  if (loading) return <div className="page-loading">Chargement…</div>;
  if (error)   return (
    <div className="page-error">
      <p>{error}</p>
      <button className="btn-retry" onClick={doLoad}>Réessayer</button>
    </div>
  );
  if (!year) return (
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
      <div style={{ padding: "48px 24px 32px", textAlign: "center" }}>
        <h1 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: "clamp(2rem,5vw,3.2rem)",
          fontWeight: 900, lineHeight: 1,
          letterSpacing: "-1px", color: "var(--cream)", marginBottom: 6,
        }}>
          In Memoriam
        </h1>
        <p style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: ".65rem", fontWeight: 300,
          letterSpacing: "5px", textTransform: "uppercase",
          color: "rgba(200,175,90,.45)", marginBottom: 28,
        }}>
          Ils nous ont quittés
        </p>

        {/* Sélecteur d'années — centré explicitement */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",   // ← le fix du collage à gauche
          marginBottom: 0,
        }}>
          {years.map(y => (
            <button key={y} onClick={() => setYear(y)} style={{
              padding: "7px 18px", borderRadius: 30,
              fontFamily: "'Outfit', sans-serif",
              fontSize: ".7rem", fontWeight: 500, letterSpacing: "1.5px",
              textTransform: "uppercase", cursor: "pointer",
              border: y === year ? "1px solid rgba(200,175,90,.7)" : "1px solid rgba(241,235,219,.12)",
              background: y === year ? "rgba(200,175,90,.15)" : "transparent",
              color: y === year ? "rgba(200,175,90,.9)" : "rgba(241,235,219,.35)",
              transition: "all .22s ease",
              flexShrink: 0,
            }}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* ── SÉPARATEUR ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        maxWidth: 400, margin: "0 auto 40px",
        padding: "0 24px",
      }}>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(200,175,90,.25))" }} />
        <span style={{ fontFamily:"'Space Mono',monospace", fontSize:".6rem", color:"rgba(200,175,90,.4)", letterSpacing:"2px", whiteSpace:"nowrap" }}>
          {liste.length} DISPARU{liste.length > 1 ? "S" : ""}
        </span>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(200,175,90,.25), transparent)" }} />
      </div>

      {/* ── CARROUSEL ── */}
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 24px" }}>
        <Carousel items={liste} />
      </div>
    </div>
  );
}