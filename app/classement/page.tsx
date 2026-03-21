// app/classement/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { pointsPourAge, calculAge } from "@/utils/fonctions";

interface Score {
  user_id: string;
  display_name: string;
  totalPoints: number;
  parisGagnants: number;
}

export default function Classement() {
  const [cl,      setCl]      = useState<Record<number, Score[]>>({});
  const [years,   setYears]   = useState<number[]>([]);
  const [year,    setYear]    = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: profs } = await supabase.from("profiles").select("user_id, display_name");
        const seen = new Set<string>();
        const profiles = (profs ?? []).filter(p => {
          if (seen.has(p.user_id)) return false;
          seen.add(p.user_id); return true;
        });

        const { data: paris } = await supabase
          .from("paris")
          .select("id, joueur, saison, candidat_id, candidats ( id, nom, ddn, ddd )");

        const byYear: Record<number, any[]> = {};
        const yearsSet = new Set<number>();
        (paris ?? []).forEach((p: any) => {
          yearsSet.add(p.saison);
          if (!byYear[p.saison]) byYear[p.saison] = [];
          byYear[p.saison].push(p);
        });

        const listYears = Array.from(yearsSet).sort((a, b) => b - a);
        const classements: Record<number, Score[]> = {};

        listYears.forEach(annee => {
          const sm: Record<string, { points: number; wins: number }> = {};
          byYear[annee].forEach((p: any) => {
            const c = p.candidats;
            if (!c?.ddd || new Date(c.ddd).getFullYear() !== annee) return;
            const pts = pointsPourAge(calculAge(c.ddn, c.ddd));
            if (!sm[p.joueur]) sm[p.joueur] = { points: 0, wins: 0 };
            sm[p.joueur].points += pts;
            sm[p.joueur].wins   += 1;
          });

          const jo = new Set(byYear[annee].map((p: any) => p.joueur));
          classements[annee] = profiles
            .filter(p => jo.has(p.user_id))
            .map(p => {
              const s = sm[p.user_id] || { points: 0, wins: 0 };
              return {
                user_id: p.user_id,
                display_name: p.display_name || "Joueur inconnu",
                totalPoints: s.points,
                parisGagnants: s.wins,
              };
            })
            .sort((a, b) =>
              b.totalPoints !== a.totalPoints
                ? b.totalPoints - a.totalPoints
                : b.parisGagnants - a.parisGagnants
            );
        });

        setCl(classements); setYears(listYears); setYear(listYears[0] ?? null);
      } catch { setError("Impossible de charger le classement."); }
      finally  { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="page-loading">Chargement…</div>;
  if (error)   return <div className="page-error"><p>{error}</p></div>;
  if (!year)   return (
    <div className="page-wrapper">
      <div className="page-container">
        <p className="empty-state">Aucun classement disponible.</p>
      </div>
    </div>
  );

  const classement = cl[year] || [];
  const top3  = classement.slice(0, 3);
  const rest  = classement.slice(3);
  const maxPts = classement[0]?.totalPoints || 1;

  // Podium order : [2e, 1er, 3e]
  const podiumOrder = top3.length === 3
    ? [top3[1], top3[0], top3[2]]
    : top3;

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
          Classement
        </h1>
        <p style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: ".65rem", fontWeight: 300,
          letterSpacing: "5px", textTransform: "uppercase",
          color: "rgba(219,135,143,.45)",
          marginBottom: 28,
        }}>
          Saison {year}
        </p>

        {/* Sélecteur d'années */}
        <div className="year-pills">
          {years.map(y => (
            <button key={y} className={`year-pill${y === year ? " active" : ""}`}
              onClick={() => setYear(y)}>{y}
            </button>
          ))}
        </div>
      </div>

      {classement.length === 0 ? (
        <p className="empty-state" style={{ marginTop: 60 }}>
          Aucun joueur n&apos;a marqué de points en {year}.
        </p>
      ) : (
        <>
          {/* ── PODIUM TOP 3 ── */}
          {top3.length > 0 && (
            <div style={{
              maxWidth: 680,
              margin: "40px auto 0",
              padding: "0 24px",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: 12,
            }}>
              {podiumOrder.map(joueur => {
                const rank      = classement.indexOf(joueur); // 0, 1, 2
                const isFirst   = rank === 0;
                const pct       = Math.round((joueur.totalPoints / maxPts) * 100);
                const podiumH   = isFirst ? 90 : rank === 1 ? 56 : 36; // hauteur du socle
                const nameColor = isFirst ? "rgba(200,175,90,.9)" : "var(--rose)";
                const ptsColor  = isFirst ? "rgba(200,175,90,.9)" : "var(--rose)";

                return (
                  <div key={joueur.user_id} style={{
                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                    transform: isFirst ? "translateY(-24px)" : "none",
                  }}>
                    {/* Numéro rang en ghost */}
                    <div style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: isFirst ? "4.5rem" : "3rem",
                      fontWeight: 900, lineHeight: 1,
                      color: isFirst ? "rgba(200,175,90,.12)" : "rgba(219,135,143,.1)",
                      letterSpacing: "-3px",
                      alignSelf: "flex-start",
                      paddingLeft: 4,
                      marginBottom: -10,
                      userSelect: "none",
                    }}>
                      {String(rank + 1).padStart(2, "0")}
                    </div>

                    {/* Score */}
                    <div style={{ textAlign: "center", marginBottom: 12, width: "100%" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4, justifyContent: "center" }}>
                        <span style={{
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: isFirst ? "2.4rem" : "1.7rem",
                          fontWeight: 900, lineHeight: 1,
                          color: ptsColor,
                        }}>
                          {joueur.totalPoints}
                        </span>
                        <span style={{
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: ".62rem", fontWeight: 300,
                          color: "rgba(241,235,219,.25)",
                          letterSpacing: "1px", textTransform: "uppercase",
                        }}>
                          pt{joueur.totalPoints > 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Barre relative */}
                      <div style={{
                        height: isFirst ? 3 : 2,
                        background: "rgba(241,235,219,.07)",
                        borderRadius: 4, overflow: "hidden",
                        margin: "8px 0",
                      }}>
                        <div style={{
                          height: "100%", width: `${pct}%`,
                          background: isFirst
                            ? "linear-gradient(90deg, #c8af5a, #a08c3a)"
                            : "linear-gradient(90deg, var(--rose), var(--rose-deep))",
                          borderRadius: 4,
                          transition: "width .8s cubic-bezier(.23,1,.32,1)",
                        }} />
                      </div>

                      <div style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: ".6rem", fontWeight: 300,
                        color: "rgba(241,235,219,.25)", letterSpacing: "1px",
                      }}>
                        {joueur.parisGagnants} pari{joueur.parisGagnants > 1 ? "s" : ""} gagnant{joueur.parisGagnants > 1 ? "s" : ""}
                      </div>
                    </div>

                    {/* Socle du podium + nom */}
                    <div style={{
                      width: "100%",
                      background: isFirst
                        ? "rgba(200,175,90,.08)"
                        : "rgba(219,135,143,.07)",
                      border: isFirst
                        ? "1px solid rgba(200,175,90,.2)"
                        : "1px solid rgba(219,135,143,.18)",
                      borderRadius: "12px 12px 0 0",
                      height: podiumH,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "12px 8px",
                    }}>
                      <Link
                        href={`/joueur/${joueur.user_id}`}
                        style={{
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: isFirst ? ".9rem" : ".78rem",
                          fontWeight: 700,
                          color: nameColor,
                          textDecoration: "none",
                          textAlign: "center",
                          lineHeight: 1.2,
                          transition: "color .15s",
                        }}
                      >
                        {joueur.display_name}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── SUITE DU CLASSEMENT ── */}
          {rest.length > 0 && (
            <div style={{
              maxWidth: 600, margin: "32px auto 0", padding: "0 24px",
            }}>
              {/* Séparateur */}
              <div style={{
                display: "flex", alignItems: "center", gap: 16, marginBottom: 20,
              }}>
                <div style={{ flex: 1, height: 1, background: "rgba(241,235,219,.07)" }} />
                <span style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: ".55rem", fontWeight: 300,
                  letterSpacing: "3px", textTransform: "uppercase",
                  color: "rgba(241,235,219,.2)",
                }}>
                  Suite
                </span>
                <div style={{ flex: 1, height: 1, background: "rgba(241,235,219,.07)" }} />
              </div>

              {rest.map((joueur, i) => {
                const rank = i + 4; // 4e, 5e…
                const pct  = Math.round((joueur.totalPoints / maxPts) * 100);
                return (
                  <div key={joueur.user_id} style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "14px 18px",
                    borderRadius: 12,
                    background: "rgba(241,235,219,.02)",
                    border: "1px solid rgba(241,235,219,.05)",
                    marginBottom: 6,
                    transition: "background .15s",
                  }}
                    onMouseOver={e => (e.currentTarget.style.background = "rgba(241,235,219,.04)")}
                    onMouseOut={e => (e.currentTarget.style.background = "rgba(241,235,219,.02)")}
                  >
                    {/* Rang */}
                    <span style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: ".7rem", fontWeight: 700,
                      color: "rgba(241,235,219,.2)",
                      minWidth: 28, textAlign: "right",
                    }}>
                      {rank}
                    </span>

                    {/* Nom + barre */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/joueur/${joueur.user_id}`} style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: ".88rem", fontWeight: 600,
                        color: "var(--rose)",
                        textDecoration: "none",
                        transition: "color .15s",
                      }}
                        onMouseOver={e => (e.currentTarget.style.color = "var(--cream)")}
                        onMouseOut={e => (e.currentTarget.style.color = "var(--rose)")}
                      >
                        {joueur.display_name}
                      </Link>
                      <div style={{
                        height: 2, background: "rgba(241,235,219,.06)",
                        borderRadius: 4, overflow: "hidden", marginTop: 6,
                      }}>
                        <div style={{
                          height: "100%", width: `${pct}%`,
                          background: "rgba(241,235,219,.15)", borderRadius: 4,
                        }} />
                      </div>
                      <span style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: ".58rem", fontWeight: 300,
                        color: "rgba(241,235,219,.22)", letterSpacing: "1px",
                        marginTop: 3, display: "block",
                      }}>
                        {joueur.parisGagnants} pari{joueur.parisGagnants > 1 ? "s" : ""} gagnant{joueur.parisGagnants > 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Score */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <span style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: "1.1rem", fontWeight: 800,
                        color: "rgba(241,235,219,.55)",
                      }}>
                        {joueur.totalPoints}
                      </span>
                      <span style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: ".55rem", fontWeight: 300,
                        color: "rgba(241,235,219,.22)",
                        letterSpacing: "1px", textTransform: "uppercase",
                        marginLeft: 4,
                      }}>
                        pt{joueur.totalPoints > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}