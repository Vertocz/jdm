// app/candidat/[id]/page.tsx
"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import CandidatCard from "@/app/components/CandidatCard";
import { calculAge } from "@/utils/fonctions";

export default function PageCandidat({ params }: { params: Promise<{ id: string }> }) {
  const { id }    = use(params);
  const [candidat, setCandidant] = useState<any>(null);
  const [votes,    setVotes]     = useState<any[]>([]);
  const [year,     setYear]      = useState<number | null>(null);
  const [years,    setYears]     = useState<number[]>([]);
  const [loading,  setLoading]   = useState(true);
  const [screenW,  setScreenW]   = useState(800);

  useEffect(() => {
    const check = () => setScreenW(window.innerWidth);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: cand } = await supabase
        .from("candidats").select("*").eq("id", Number(id)).maybeSingle();
      setCandidant(cand);
      if (!cand) { setLoading(false); return; }

      const { data: paris } = await supabase
        .from("paris").select("id, saison, joueur").eq("candidat_id", Number(id));
      if (!paris?.length) { setLoading(false); return; }

      const joueurs = [...new Set(paris.map((p: any) => p.joueur))];
      const { data: profs } = await supabase
        .from("profiles").select("user_id, display_name").in("user_id", joueurs);

      const vc = paris.map((p: any) => ({
        ...p,
        display_name: profs?.find((pr: any) => pr.user_id === p.joueur)?.display_name ?? "Joueur inconnu",
      }));
      setVotes(vc);
      const uy = [...new Set(vc.map((v: any) => v.saison))].sort((a: any, b: any) => b - a);
      setYears(uy as number[]);
      setYear((uy[0] as number) ?? null);
      setLoading(false);
    })();
  }, [id]);

  if (loading)   return <div className="page-loading">Chargement…</div>;
  if (!candidat) return (
    <div className="page-wrapper">
      <div className="page-container">
        <p className="empty-state">Candidat introuvable.</p>
      </div>
    </div>
  );

  const isDead    = !!candidat.ddd;
  const deathYear = isDead ? new Date(candidat.ddd).getFullYear() : null;

  const totalVotes    = votes.length;
  const firstVoteYear = totalVotes > 0 ? Math.min(...votes.map((v: any) => v.saison)) : null;
  const gagnants      = isDead ? votes.filter((v: any) => v.saison === deathYear) : [];
  const votesYear     = year ? votes.filter((v: any) => v.saison === year) : [];

  // Couleurs selon vivant / mort
  const accentColor  = isDead ? "rgba(200,175,90,.8)"  : "var(--rose)";
  const accentBg     = isDead ? "rgba(200,175,90,.1)"  : "rgba(219,135,143,.1)";
  const accentBorder = isDead ? "rgba(200,175,90,.22)" : "rgba(219,135,143,.22)";

  // Scale de la carte Panini selon l'écran
  const CARD_W     = 210;
  const CARD_H     = 300;
  const maxScale   = 1.6;
  const available  = Math.min(screenW - 48, 380);
  const cardScale  = Math.min(maxScale, available / CARD_W);
  const scaledW    = Math.round(CARD_W * cardScale);
  const scaledH    = Math.round(CARD_H * cardScale);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>

      {/* ══ CARTE PANINI HERO ═══════════════════════════════════════════════ */}
      <div style={{ padding: "52px 24px 0", display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Numéro de série au-dessus */}
        <p style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: ".58rem", color: "rgba(241,235,219,.2)",
          letterSpacing: "2px", marginBottom: 16,
        }}>
          #{String(candidat.id).padStart(4, "0")}
        </p>

        {/* Carte scalée — pas de lien (on est déjà sur la page) */}
        <div style={{ width: scaledW, height: scaledH, position: "relative", overflow: "visible", flexShrink: 0 }}>
          <div style={{
            position: "absolute", top: 0, left: 0,
            transformOrigin: "top left",
            transform: `scale(${cardScale})`,
            pointerEvents: "none", // désactive le lien dans la carte
          }}>
            <CandidatCard candidat={candidat} showDescription={false} />
          </div>
        </div>

        {/* Nom sous la carte */}
        <h1 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: "clamp(1.6rem, 4vw, 2.6rem)",
          fontWeight: 900, lineHeight: 1,
          letterSpacing: "-1px", color: "var(--cream)",
          textAlign: "center",
          marginTop: 28, marginBottom: 0,
        }}>
          {candidat.nom}
        </h1>

        {/* Description */}
        {candidat.description && (
          <p style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: "1.05rem", fontWeight: 300,
            color: "rgba(241,235,219,.5)",
            lineHeight: 1.65, fontStyle: "italic",
            textAlign: "center",
            maxWidth: 520,
            marginTop: 14,
          }}>
            {candidat.description.charAt(0).toUpperCase() + candidat.description.slice(1)}
          </p>
        )}
      </div>

      {/* ══ SÉPARATEUR ══════════════════════════════════════════════════════ */}
      <Divider label="Statistiques de jeu" />

      {/* ══ TUILES STATS ════════════════════════════════════════════════════ */}
      <div style={{
        maxWidth: 600, margin: "0 auto 0",
        padding: "0 20px",
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 10,
      }}>
        <StatTile
          label={`Pari${totalVotes > 1 ? "s" : ""} au total`}
          value={String(totalVotes)}
          accent={accentColor} border={accentBorder} bg={accentBg}
          large={totalVotes > 0}
        />
        <StatTile
          label="Premier pari"
          value={firstVoteYear ? String(firstVoteYear) : "—"}
          accent="rgba(241,235,219,.4)" border="rgba(241,235,219,.07)" bg="rgba(241,235,219,.02)"
        />
        {isDead && gagnants.length > 0 && (
          <StatTile
            label={`Gagnant${gagnants.length > 1 ? "s" : ""} en ${deathYear}`}
            value={String(gagnants.length)}
            accent={accentColor} border={accentBorder} bg={accentBg}
            large wide
          />
        )}
      </div>

      {/* ══ PARIEURS ════════════════════════════════════════════════════════ */}
      {years.length > 0 && (
        <>
          <Divider label="Parieurs" />

          <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 20px" }}>

            {/* Pills d'années */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20, justifyContent: "center" }}>
              {years.map(y => {
                const isActive  = y === year;
                const isWinYear = isDead && y === deathYear;
                return (
                  <button
                    key={y}
                    onClick={() => setYear(y)}
                    style={{
                      padding: "7px 18px", borderRadius: 30, cursor: "pointer",
                      fontFamily: "'Outfit',sans-serif", fontSize: ".7rem", fontWeight: 500,
                      letterSpacing: "1.5px", textTransform: "uppercase",
                      border: isActive ? `1px solid ${accentBorder}` : "1px solid rgba(241,235,219,.12)",
                      background: isActive ? accentBg : "transparent",
                      color: isActive ? accentColor : "rgba(241,235,219,.35)",
                      transition: "all .2s ease",
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    {y}
                    {isWinYear && (
                      <span style={{ fontSize: ".55rem", fontWeight: 700, color: "rgba(200,175,90,.8)", letterSpacing: "1px" }}>
                        WIN
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Liste */}
            {votesYear.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "32px 0", borderRadius: 16,
                background: "rgba(241,235,219,.02)", border: "1px dashed rgba(241,235,219,.08)",
              }}>
                <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".88rem", fontWeight: 300, color: "rgba(241,235,219,.3)" }}>
                  Aucun parieur pour {year}.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {votesYear.map((v: any) => {
                  const isWinner = isDead && v.saison === deathYear;
                  return (
                    <div
                      key={v.id}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "13px 18px", borderRadius: 12,
                        background: isWinner ? "rgba(200,175,90,.07)" : "rgba(241,235,219,.025)",
                        border: isWinner ? "1px solid rgba(200,175,90,.18)" : "1px solid rgba(241,235,219,.05)",
                        transition: "background .15s",
                      }}
                    >
                      <Link
                        href={`/joueur/${v.joueur}`}
                        style={{
                          fontFamily: "'Outfit',sans-serif",
                          fontSize: ".9rem", fontWeight: 600,
                          color: isWinner ? "rgba(200,175,90,.85)" : "var(--rose)",
                          textDecoration: "none",
                        }}
                      >
                        {v.display_name}
                      </Link>
                      {isWinner && (
                        <span style={{
                          fontFamily: "'Outfit',sans-serif",
                          fontSize: ".55rem", fontWeight: 700,
                          letterSpacing: "2px", textTransform: "uppercase",
                          color: "rgba(200,175,90,.65)",
                          background: "rgba(200,175,90,.1)",
                          border: "1px solid rgba(200,175,90,.2)",
                          borderRadius: 20, padding: "3px 10px",
                        }}>
                          Gagnant
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Séparateur ─────────────────────────────────────────────────────────── */
function Divider({ label }: { label: string }) {
  return (
    <div style={{
      maxWidth: 600, margin: "40px auto 24px",
      padding: "0 20px",
      display: "flex", alignItems: "center", gap: 16,
    }}>
      <div style={{ flex: 1, height: 1, background: "rgba(241,235,219,.07)" }} />
      <span style={{
        fontFamily: "'Outfit',sans-serif",
        fontSize: ".58rem", fontWeight: 300,
        letterSpacing: "4px", textTransform: "uppercase",
        color: "rgba(241,235,219,.2)",
        whiteSpace: "nowrap",
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: "rgba(241,235,219,.07)" }} />
    </div>
  );
}

/* ── Tuile de stat ──────────────────────────────────────────────────────── */
function StatTile({ label, value, accent, border, bg, large = false, wide = false }: {
  label: string; value: string;
  accent: string; border: string; bg: string;
  large?: boolean; wide?: boolean;
}) {
  return (
    <div style={{
      gridColumn: wide ? "1 / -1" : undefined,
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 14,
      padding: "16px 14px",
      textAlign: "center",
      display: "flex", flexDirection: "column", justifyContent: "center", gap: 4,
    }}>
      <div style={{
        fontFamily: "'Outfit',sans-serif",
        fontSize: large ? "1.5rem" : "1rem",
        fontWeight: 800, lineHeight: 1,
        color: large ? accent : "var(--cream)",
        marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: "'Outfit',sans-serif",
        fontSize: ".55rem", fontWeight: 300,
        letterSpacing: "1.5px", textTransform: "uppercase",
        color: "rgba(241,235,219,.3)",
      }}>
        {label}
      </div>
    </div>
  );
}