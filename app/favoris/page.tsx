// app/favoris/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CandidatCard from "@/app/components/CandidatCard";

type Entry = { candidat_id: number; totalVotes: number; candidat: any };

export default function Favoris() {
  const [topAll,  setTopAll]  = useState<Entry[]>([]);
  const [topYear, setTopYear] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [screenW, setScreenW] = useState(820);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const check = () => setScreenW(window.innerWidth);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const doLoad = async () => {
    setError(null); setLoading(true);
    try {
      const { data: paris, error: e } = await supabase.from("paris").select("*");
      if (e) throw e;

      // All time
      const gAll: Record<number, number> = {};
      (paris ?? []).forEach((p: any) => { gAll[p.candidat_id] = (gAll[p.candidat_id] || 0) + 1; });
      const topA = Object.entries(gAll)
        .map(([id, v]) => ({ candidat_id: Number(id), totalVotes: v as number }))
        .sort((a, b) => b.totalVotes - a.totalVotes)
        .slice(0, 3);
      if (topA.length) {
        const { data: cands } = await supabase.from("candidats").select("*").in("id", topA.map(e => e.candidat_id));
        const m: Record<number, any> = {};
        (cands ?? []).forEach((c: any) => (m[c.id] = c));
        setTopAll(topA.map(e => ({ ...e, candidat: m[e.candidat_id] })));
      }

      // Année courante
      const parisY = (paris ?? []).filter((p: any) => p.saison === currentYear);
      const gY: Record<number, number> = {};
      parisY.forEach((p: any) => { gY[p.candidat_id] = (gY[p.candidat_id] || 0) + 1; });
      const eli = Object.entries(gY)
        .filter(([, v]) => v >= 3)
        .map(([id, v]) => ({ candidat_id: Number(id), totalVotes: v as number }))
        .sort((a, b) => b.totalVotes - a.totalVotes)
        .slice(0, 3);
      if (eli.length) {
        const { data: cands } = await supabase.from("candidats").select("*").in("id", eli.map(e => e.candidat_id));
        const m: Record<number, any> = {};
        (cands ?? []).forEach((c: any) => (m[c.id] = c));
        setTopYear(eli.map(e => ({ ...e, candidat: m[e.candidat_id] })));
      }
    } catch {
      setError("Impossible de charger les favoris.");
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

  const maxVotesAll  = topAll[0]?.totalVotes  ?? 1;
  const maxVotesYear = topYear[0]?.totalVotes ?? 1;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>

      {/* ── EN-TÊTE ── */}
      <div style={{ padding: "48px 24px 0", textAlign: "center" }}>
        <h1 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: "clamp(2rem,5vw,3.2rem)",
          fontWeight: 900, lineHeight: 1,
          letterSpacing: "-1px", color: "var(--cream)",
          marginBottom: 6,
        }}>
          Favoris
        </h1>
        <p style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: ".65rem", fontWeight: 300,
          letterSpacing: "5px", textTransform: "uppercase",
          color: "rgba(219,135,143,.45)",
          marginBottom: 0,
        }}>
          Les candidats les plus nommés de tous les temps
        </p>
      </div>

      {/* ── PODIUM ALL TIME ── */}
      {topAll.length > 0 && (
        <Podium entries={topAll} maxVotes={maxVotesAll} screenW={screenW} />
      )}

      {/* ── SECTION ANNUELLE ── */}
      {topYear.length >= 3 && (
        <>
          <div style={{
            maxWidth: 800, margin: "0 auto 0",
            padding: "0 24px",
            display: "flex", alignItems: "center", gap: 20,
          }}>
            <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(241,235,219,.08))" }} />
            <p style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: ".62rem", fontWeight: 300,
              letterSpacing: "5px", textTransform: "uppercase",
              color: "rgba(219,135,143,.35)",
              margin: 0, whiteSpace: "nowrap",
            }}>
              Saison {currentYear}
            </p>
            <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(241,235,219,.08), transparent)" }} />
          </div>

          <Podium entries={topYear} maxVotes={maxVotesYear} accent="year" screenW={screenW} />
        </>
      )}
    </div>
  );
}

/* ── Cache scrollbar podium ─────────────────────────────────────────────── */
/* Inline style scrollbarWidth:none gère Firefox, le style global gère WebKit */

/* ── Podium ──────────────────────────────────────────────────────────────── */
function Podium({ entries, maxVotes, accent = "alltime", screenW = 820 }: {
  entries: Entry[];
  maxVotes: number;
  accent?: "alltime" | "year";
  screenW?: number;
}) {
  // Réordonne : [2e, 1er, 3e] pour l'effet podium
  const order = entries.length === 3
    ? [entries[1], entries[0], entries[2]]
    : entries;


  // Échelles par rang : #1 grand, #2 moyen, #3 petit
  const RANK_SCALES = [1, 0.82, 0.68]; // rank 0, 1, 2
  const PAD = 48;
  // Largeur totale avec les 3 échelles : 210*1 + 210*0.82 + 210*0.68 + 2*16 + 48
  const NATURAL_W = 210 * (1 + 0.82 + 0.68) + 2 * 16 + PAD; // ~619px
  // Si l'écran est plus étroit, on scale tout proportionnellement
  const globalScale = screenW < NATURAL_W ? Math.max(0.5, screenW / NATURAL_W) : 1;
  const gap = Math.round(16 * globalScale);

  return (
    <div style={{ overflow: "hidden", margin: "0 auto", maxWidth: 860 }}>
    <div style={{
      margin: "24px 0 60px",
      padding: "18px 24px 0",  /* 18px top = absorbe hover 10px + marge */
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      gap: gap,
    }}>
      {order.map((entry, podiumPos) => {
        // retrouver le rang réel (0, 1, 2)
        const rank = entries.indexOf(entry);
        const pct  = (entry.totalVotes / maxVotes) * 100;
        const isFirst = rank === 0;

        return (
          <div
            key={entry.candidat_id}
            style={{
              display: "flex",
              flexDirection: "column",
              width: Math.round(210 * (RANK_SCALES[rank] ?? 0.68) * globalScale),
              flexShrink: 0,
              alignItems: "center",
              gap: 0,
            }}
          >
            {/* Rang en ghost text */}
            <div style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: `${(isFirst ? 4.5 : rank === 1 ? 3 : 2.2) * globalScale}rem`,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: "-3px",
              color: isFirst
                ? "rgba(219,135,143,.12)"
                : "rgba(241,235,219,.06)",
              marginBottom: -8,
              userSelect: "none",
              alignSelf: "flex-start",
              paddingLeft: 4,
            }}>
              {String(rank + 1).padStart(2, "0")}
            </div>

            {/* Bloc vote */}
            <div style={{ width: Math.round(210 * (RANK_SCALES[rank] ?? 0.68) * globalScale), marginBottom: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Chiffre de votes */}
              <div style={{
                display: "flex",
                alignItems: "baseline",
                gap: 6,
              }}>
                <span style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: `${(isFirst ? 2.6 : rank === 1 ? 1.9 : 1.4) * globalScale}rem`,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: isFirst ? "var(--rose)" : "rgba(241,235,219,.65)",
                }}>
                  {entry.totalVotes}
                </span>
                <span style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: ".65rem",
                  fontWeight: 300,
                  color: "rgba(241,235,219,.3)",
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                }}>
                  pari{entry.totalVotes > 1 ? "s" : ""}
                </span>
              </div>

              {/* Barre de popularité relative */}
              <div style={{
                height: isFirst ? 3 : 2,
                background: "rgba(241,235,219,.07)",
                borderRadius: 4,
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${pct}%`,
                  borderRadius: 4,
                  background: isFirst
                    ? "linear-gradient(90deg, var(--rose), var(--rose-deep))"
                    : "rgba(241,235,219,.25)",
                  transition: "width .8s cubic-bezier(.23,1,.32,1)",
                }} />
              </div>
            </div>

            {/* Carte — échelle par rang, alignée en bas */}
            {(() => {
              const s = (RANK_SCALES[rank] ?? 0.68) * globalScale;
              const w = Math.round(210 * s);
              const h = Math.round(300 * s);
              return (
                <div style={{ width: w, height: h, position: "relative", overflow: "visible", flexShrink: 0 }}>
                  <div style={{ position: "absolute", top: 0, left: 0, transformOrigin: "top left", transform: `scale(${s})` }}>
                    <CandidatCard candidat={entry.candidat} showDescription={false} />
                  </div>
                </div>
              );
            })()}


          </div>
        );
      })}
    </div>
    </div>
  );
}