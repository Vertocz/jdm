// app/joueur/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import CandidatCard from "@/app/components/CandidatCard";
import { pointsPourAge, calculAge } from "@/utils/fonctions";

export default function JoueurPage() {
  const { id: userId } = useParams() as { id: string };
  const [profile,  setProfile]  = useState<any>(null);
  const [paris,    setParis]    = useState<any[]>([]);
  const [year,     setYear]     = useState<number>(new Date().getFullYear());
  const [years,    setYears]    = useState<number[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [screenW,  setScreenW]  = useState(800);

  useEffect(() => {
    const check = () => setScreenW(window.innerWidth);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const doLoad = useCallback(async () => {
    setError(null); setLoading(true);
    try {
      const { data: prof } = await supabase
        .from("profiles").select("display_name")
        .eq("user_id", userId).maybeSingle();
      if (!prof) { setLoading(false); return; }
      setProfile(prof);

      const { data } = await supabase
        .from("paris")
        .select("id, mort, saison, candidat_id, candidats ( id, nom, ddn, ddd, description, photo )")
        .eq("joueur", userId);

      const d = data ?? [];
      setParis(d);

      const cur = new Date().getFullYear();
      const uy = [...new Set(d.map((p: any) => p.saison) as number[])].sort((a, b) => b - a);
      if (!uy.includes(cur)) uy.unshift(cur);
      setYears(uy); setYear(cur);
    } catch { setError("Impossible de charger ce profil."); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { doLoad(); }, [doLoad]);

  if (loading) return <div className="page-loading">Chargement…</div>;
  if (error) return (
    <div className="page-error">
      <p>{error}</p>
      <button className="btn-retry" onClick={doLoad}>Réessayer</button>
    </div>
  );
  if (!profile) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ fontFamily: "'Outfit',sans-serif", color: "rgba(241,235,219,.35)", fontSize: ".88rem" }}>Joueur introuvable.</p>
    </div>
  );

  const pfy      = paris.filter((p: any) => p.saison === year);
  const enCours  = pfy.filter((p: any) => { const d = p.candidats?.ddd; return !d || new Date(d).getFullYear() > year; });
  const gagnants = pfy.filter((p: any) => { const d = p.candidats?.ddd; return d && new Date(d).getFullYear() === year; });

  const totalPoints    = gagnants.reduce((s: number, p: any) => s + pointsPourAge(calculAge(p.candidats.ddn, p.candidats.ddd)), 0);
  const enCoursAvecAge = enCours.map((p: any) => ({ ...p, age: calculAge(p.candidats.ddn, p.candidats.ddd) }));
  const coupDePoker    = enCoursAvecAge.length > 0 ? enCoursAvecAge.reduce((best: any, p: any) => ((p.age ?? 999) < (best.age ?? 999) ? p : best)) : null;
  const moyenneAge     = enCoursAvecAge.length > 0 ? Math.round(enCoursAvecAge.reduce((s: number, p: any) => s + (p.age ?? 0), 0) / enCoursAvecAge.length) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* ── EN-TÊTE ── */}
      <div style={{ padding: "48px 0 0", textAlign: "center" }}>
        <h1 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: "clamp(2rem,5vw,3.2rem)",
          fontWeight: 900, lineHeight: 1,
          letterSpacing: "-1px", color: "var(--cream)",
          marginBottom: 6,
        }}>
          {profile.display_name}
        </h1>
        <p style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: ".65rem", fontWeight: 300,
          letterSpacing: "5px", textTransform: "uppercase",
          color: "rgba(219,135,143,.5)", marginBottom: 28,
        }}>
          Salle d&apos;attente
        </p>

        {/* Sélecteur d'années */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 32, padding: "0 16px" }}>
          {years.map(y => (
            <button key={y} onClick={() => setYear(y)} style={{
              padding: "7px 18px", borderRadius: 30, cursor: "pointer", flexShrink: 0,
              fontFamily: "'Outfit',sans-serif", fontSize: ".7rem", fontWeight: 500, letterSpacing: "1.5px", textTransform: "uppercase",
              border: y === year ? "1px solid rgba(219,135,143,.7)" : "1px solid rgba(241,235,219,.15)",
              background: y === year ? "rgba(219,135,143,.15)" : "transparent",
              color: y === year ? "var(--rose)" : "rgba(241,235,219,.4)",
              transition: "all .22s ease",
            }}>{y}</button>
          ))}
        </div>
      </div>

      {/* ── STATS ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        maxWidth: 500,
        margin: "0 auto 36px",
        padding: "0 16px",
      }}>
        <StatTile value={totalPoints} label={`Pt${totalPoints > 1 ? "s" : ""} en ${year}`} accent />
        <StatTile value={moyenneAge ? `${moyenneAge} ans` : "—"} label="Moyenne d'âge" />
        {coupDePoker && (
          <StatTile
            value={coupDePoker.candidats.nom.split(" ").slice(-1)[0]}
            label={`Coup de poker · ${coupDePoker.age} ans`}
            small
            wide
          />
        )}
      </div>

      {/* ── CARTES ── */}
      <div style={{ padding: "0 24px 60px", maxWidth: 1200, margin: "0 auto" }}>

        <SectionHeader label="Paris en cours" count={enCours.length} max={10} />
        {enCours.length === 0 ? (
          <EmptySection label={`Aucun pari en cours pour ${year}.`} />
        ) : (
          <CardGrid items={enCours.map((p: any) => p.candidats)} screenW={screenW} />
        )}

        <SectionHeader label="Paris gagnants" count={gagnants.length} style={{ marginTop: 60 }} />
        {gagnants.length === 0 ? (
          <EmptySection label={`Aucun pari gagnant en ${year}.`} />
        ) : (
          <CardGrid items={gagnants.map((p: any) => p.candidats)} screenW={screenW} />
        )}
      </div>
    </div>
  );
}

/* ── Grille de cartes : 2 colonnes sur mobile avec scale, flex sur desktop ── */
function CardGrid({ items, screenW }: { items: any[]; screenW: number }) {
  const CARD_W    = 210;
  const CARD_H    = 300;
  const GAP       = 12;
  const PAD       = 32;
  const COLS      = 2;
  const available = screenW - PAD - GAP;
  const colW      = available / COLS;
  const scale     = colW < CARD_W ? Math.max(0.45, colW / CARD_W) : 1;
  const isMobile  = scale < 1;

  if (!isMobile) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center", marginBottom: 8 }}>
        {items.map((c: any) => <CandidatCard key={c.id} candidat={c} />)}
      </div>
    );
  }

  const scaledW = Math.round(CARD_W * scale);
  const scaledH = Math.round(CARD_H * scale);
  const rowGap  = Math.round(GAP * scale);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${COLS}, ${scaledW}px)`,
      gap: `${rowGap}px ${GAP}px`,
      justifyContent: "center",
      marginBottom: 8,
    }}>
      {items.map((cand: any) => (
        <div key={cand.id} style={{ width: scaledW, height: scaledH, position: "relative", overflow: "visible" }}>
          <div style={{
            position: "absolute", top: 0, left: 0,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
          }}>
            <CandidatCard candidat={cand} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Composants locaux ───────────────────────────────────────────────────── */
function StatTile({ value, label, accent = false, small = false, wide = false }: {
  value: string | number; label: string; accent?: boolean; small?: boolean; wide?: boolean;
}) {
  return (
    <div style={{
      gridColumn: wide ? "1 / -1" : undefined,
      flexShrink: 0,
      minWidth: 120,
      background: accent ? "rgba(219,135,143,.1)" : "rgba(241,235,219,.03)",
      border: `1px solid ${accent ? "rgba(219,135,143,.22)" : "rgba(241,235,219,.07)"}`,
      borderRadius: 14,
      padding: "16px 20px",
      textAlign: "center",
      display: "flex", flexDirection: "column", justifyContent: "center", gap: 4,
    }}>
      <div style={{
        fontFamily: "'Outfit',sans-serif",
        fontSize: small ? ".9rem" : "1.5rem",
        fontWeight: 800, lineHeight: 1,
        color: accent ? "var(--rose)" : "var(--cream)",
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: "'Outfit',sans-serif",
        fontSize: ".58rem", fontWeight: 300,
        letterSpacing: "1px", textTransform: "uppercase",
        color: "rgba(241,235,219,.3)",
        marginTop: 2,
      }}>
        {label}
      </div>
    </div>
  );
}

function SectionHeader({ label, count, max, style: s = {} }: {
  label: string; count: number; max?: number; style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, ...s }}>
      <h2 style={{ fontFamily: "'Outfit',sans-serif", fontSize: "1rem", fontWeight: 700, color: "var(--cream)", margin: 0 }}>{label}</h2>
      <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(241,235,219,.12), transparent)" }} />
      <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".65rem", fontWeight: 600, color: "rgba(219,135,143,.6)", background: "rgba(219,135,143,.1)", border: "1px solid rgba(219,135,143,.2)", borderRadius: 20, padding: "3px 10px" }}>
        {count}{max ? `/${max}` : ""}
      </span>
    </div>
  );
}

function EmptySection({ label, cta }: { label: string; cta?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 0", borderRadius: 16, background: "rgba(241,235,219,.02)", border: "1px dashed rgba(241,235,219,.08)", marginBottom: 8 }}>
      <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".88rem", fontWeight: 300, color: "rgba(241,235,219,.3)" }}>{label}</p>
      {cta && <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: ".72rem", fontWeight: 300, color: "rgba(241,235,219,.18)", marginTop: 6 }}>{cta}</p>}
    </div>
  );
}