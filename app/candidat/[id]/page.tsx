// app/candidat/[id]/page.tsx
"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { formatFr, calculAge, pointsPourAge, formatNomCarte } from "@/utils/fonctions";

export default function PageCandidat({ params }: { params: Promise<{ id: string }> }) {
  const { id }     = use(params);
  const [candidat, setCandidant]   = useState<any>(null);
  const [votes,    setVotes]       = useState<any[]>([]);
  const [year,     setYear]        = useState<number | null>(null);
  const [years,    setYears]       = useState<number[]>([]);
  const [loading,  setLoading]     = useState(true);

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

  const isDead     = !!candidat.ddd;
  const age        = calculAge(candidat.ddn, candidat.ddd);
  const points     = pointsPourAge(age);
  const deathYear  = isDead ? new Date(candidat.ddd).getFullYear() : null;
  const photoUrl   = candidat.photo
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(candidat.photo.replace(/ /g, "_"))}`
    : null;

  const totalVotes    = votes.length;
  const firstVoteYear = totalVotes > 0 ? Math.min(...votes.map((v: any) => v.saison)) : null;
  const gagnants      = isDead ? votes.filter((v: any) => v.saison === deathYear) : [];
  const votesYear     = year ? votes.filter((v: any) => v.saison === year) : [];

  const { display, fontSize, letterSpacing } = formatNomCarte(candidat.nom);

  // Couleurs selon vivant/mort
  const accentColor = isDead ? "rgba(200,175,90,.8)" : "var(--rose)";
  const accentBg    = isDead ? "rgba(200,175,90,.1)"  : "rgba(219,135,143,.1)";
  const accentBorder= isDead ? "rgba(200,175,90,.22)" : "rgba(219,135,143,.22)";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>

      {/* ══ HERO ══════════════════════════════════════════════════════════ */}
      <div style={{
        maxWidth: 900, margin: "0 auto",
        padding: "52px 32px 0",
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        gap: 48,
        alignItems: "start",
      }}>

        {/* Colonne gauche — Photo + carte panini */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Photo grande */}
          <div style={{
            width: 240, height: 300,
            borderRadius: 16,
            overflow: "hidden",
            position: "relative",
            border: `1px solid ${isDead ? "rgba(200,175,90,.2)" : "rgba(219,135,143,.15)"}`,
            boxShadow: "0 8px 40px rgba(0,0,0,.5)",
            flexShrink: 0,
          }}>
            {photoUrl ? (
              <>
                <div id="hero-ph" style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(160deg, #1e1a14, #0e0e10)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "4rem", color: "rgba(241,235,219,.08)",
                  filter: isDead ? "grayscale(1) brightness(.65)" : "none",
                }}>◆</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl}
                  alt={candidat.nom}
                  onLoad={e => {
                    (e.target as HTMLImageElement).style.display = "block";
                    const ph = document.getElementById("hero-ph");
                    if (ph) ph.style.display = "none";
                  }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  style={{
                    display: "none", position: "absolute", inset: 0,
                    width: "100%", height: "100%",
                    objectFit: "cover", objectPosition: "center top",
                    filter: isDead ? "grayscale(1) brightness(.75)" : "none",
                  }}
                />
                {/* Gradient bas */}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0, height: 80,
                  background: `linear-gradient(to top, ${isDead ? "#141208" : "var(--bg)"}, transparent)`,
                }} />
              </>
            ) : (
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(160deg, #1e1a14, #0e0e10)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "5rem", color: "rgba(241,235,219,.07)",
              }}>◆</div>
            )}
          </div>
        </div>

        {/* Colonne droite — Infos */}
        <div style={{ paddingTop: 4 }}>

          {/* Numéro de série */}
          <p style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: ".68rem", color: "rgba(241,235,219,.2)",
            letterSpacing: "2px", marginBottom: 8,
          }}>
            #{String(candidat.id).padStart(4, "0")}
          </p>

          {/* Nom */}
          <h1 style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: "clamp(1.8rem, 4vw, 3rem)",
            fontWeight: 900, lineHeight: 1,
            letterSpacing: "-1px", color: "var(--cream)",
            marginBottom: 8,
          }}>
            {candidat.nom}
          </h1>

          {/* Description */}
          {candidat.description && (
            <p style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: ".88rem", fontWeight: 300,
              color: "rgba(241,235,219,.45)",
              lineHeight: 1.65, fontStyle: "italic",
              borderLeft: `2px solid ${accentColor}`,
              paddingLeft: 14, marginBottom: 28,
              opacity: 0.9,
            }}>
              {candidat.description.charAt(0).toUpperCase() + candidat.description.slice(1)}
            </p>
          )}

          {/* Dates + âge + points en ligne horizontale */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
            gap: 10, marginBottom: 28,
          }}>
            <InfoTile label="Naissance" value={formatFr(candidat.ddn)} accent={accentColor} border={accentBorder} bg={accentBg} />
            {isDead && <InfoTile label="Décès" value={formatFr(candidat.ddd)} accent={accentColor} border={accentBorder} bg={accentBg} />}
            <InfoTile label="Âge" value={age !== null ? `${age} ans` : "—"} accent={accentColor} border={accentBorder} bg={accentBg} />
            <InfoTile
              label={`Point${points > 1 ? "s" : ""}`}
              value={String(points)}
              accent={accentColor} border={accentBorder} bg={accentBg}
              large
            />
          </div>
        </div>
      </div>

      {/* ══ SÉPARATEUR ════════════════════════════════════════════════════ */}
      <div style={{
        maxWidth: 900, margin: "40px auto 0",
        padding: "0 32px",
        display: "flex", alignItems: "center", gap: 20,
      }}>
        <div style={{ flex: 1, height: 1, background: "rgba(241,235,219,.07)" }} />
        <span style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: ".58rem", fontWeight: 300,
          letterSpacing: "4px", textTransform: "uppercase",
          color: "rgba(241,235,219,.2)",
        }}>
          Statistiques de jeu
        </span>
        <div style={{ flex: 1, height: 1, background: "rgba(241,235,219,.07)" }} />
      </div>

      {/* ══ STATS PARIS ═══════════════════════════════════════════════════ */}
      <div style={{
        maxWidth: 900, margin: "24px auto 0",
        padding: "0 32px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
        gap: 10,
      }}>
        <InfoTile label={`Pari${totalVotes > 1 ? "s" : ""} au total`} value={String(totalVotes)}
          accent={accentColor} border={accentBorder} bg={accentBg} large />
        <InfoTile label="Premier pari" value={firstVoteYear ? String(firstVoteYear) : "—"}
          accent="rgba(241,235,219,.4)" border="rgba(241,235,219,.07)" bg="rgba(241,235,219,.02)" />
        {isDead && gagnants.length > 0 && (
          <InfoTile label={`Gagnant${gagnants.length > 1 ? "s" : ""}`} value={String(gagnants.length)}
            accent={accentColor} border={accentBorder} bg={accentBg} large />
        )}
      </div>

      {/* ══ PARIEURS ══════════════════════════════════════════════════════ */}
      {years.length > 0 && (
        <div style={{ maxWidth: 900, margin: "40px auto 0", padding: "0 32px" }}>

          {/* Header section */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: "1rem", fontWeight: 700,
              color: "var(--cream)", margin: 0,
            }}>
              Parieurs
            </h2>
            <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(241,235,219,.1), transparent)" }} />
          </div>

          {/* Sélecteur d'années */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {years.map(y => {
              const isActive = y === year;
              const isWinYear = isDead && y === deathYear;
              return (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 30,
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: ".7rem", fontWeight: 500, letterSpacing: "1.5px",
                    textTransform: "uppercase", cursor: "pointer",
                    border: isActive
                      ? `1px solid ${accentBorder}`
                      : "1px solid rgba(241,235,219,.12)",
                    background: isActive ? accentBg : "transparent",
                    color: isActive ? accentColor : "rgba(241,235,219,.35)",
                    transition: "all .2s ease",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {y}
                  {isWinYear && (
                    <span style={{
                      fontSize: ".55rem", fontWeight: 700,
                      color: "rgba(200,175,90,.8)",
                      letterSpacing: "1px",
                    }}>
                      WIN
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Liste des parieurs */}
          {votesYear.length === 0 ? (
            <p style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: ".85rem", fontWeight: 300,
              color: "rgba(241,235,219,.25)",
              padding: "20px 0",
            }}>
              Aucun parieur pour {year}.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {votesYear.map((v: any) => {
                const isWinner = isDead && v.saison === deathYear;
                return (
                  <div
                    key={v.id}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "13px 18px",
                      borderRadius: 12,
                      background: isWinner ? "rgba(200,175,90,.07)" : "rgba(241,235,219,.025)",
                      border: isWinner ? "1px solid rgba(200,175,90,.18)" : "1px solid rgba(241,235,219,.05)",
                      transition: "background .15s",
                    }}
                  >
                    <Link
                      href={`/joueur/${v.joueur}`}
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: ".9rem", fontWeight: 600,
                        color: isWinner ? "rgba(200,175,90,.85)" : "var(--rose)",
                        textDecoration: "none",
                        transition: "color .15s",
                      }}
                    >
                      {v.display_name}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Responsive mobile */}
      <style>{`
        @media (max-width: 640px) {
          .candidat-hero-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ── Tuile d'info ────────────────────────────────────────────────────────── */
function InfoTile({
  label, value, accent, border, bg, large = false,
}: {
  label: string; value: string;
  accent: string; border: string; bg: string;
  large?: boolean;
}) {
  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 14,
      padding: "16px 14px",
      textAlign: "center",
    }}>
      <div style={{
        fontFamily: "'Outfit', sans-serif",
        fontSize: large ? "1.5rem" : "1rem",
        fontWeight: 800, lineHeight: 1,
        color: large ? accent : "var(--cream)",
        marginBottom: 5,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: "'Outfit', sans-serif",
        fontSize: ".55rem", fontWeight: 300,
        letterSpacing: "1.5px", textTransform: "uppercase",
        color: "rgba(241,235,219,.3)",
      }}>
        {label}
      </div>
    </div>
  );
}