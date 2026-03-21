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
  if (error)   return (
    <div className="page-error">
      <p>{error}</p>
      <button className="btn-retry" onClick={doLoad}>Réessayer</button>
    </div>
  );
  if (!profile) return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <p style={{ fontFamily:"'Outfit',sans-serif", color:"rgba(241,235,219,.35)", fontSize:".88rem" }}>Joueur introuvable.</p>
    </div>
  );

  const pfy      = paris.filter((p: any) => p.saison === year);
  const enCours  = pfy.filter((p: any) => { const d = p.candidats?.ddd; return !d || new Date(d).getFullYear() > year; });
  const gagnants = pfy.filter((p: any) => { const d = p.candidats?.ddd; return d && new Date(d).getFullYear() === year; });

  const totalPoints = gagnants.reduce((s: number, p: any) =>
    s + pointsPourAge(calculAge(p.candidats.ddn, p.candidats.ddd)), 0);

  const ecA  = enCours.map((p: any) => ({ ...p, age: calculAge(p.candidats.ddn, p.candidats.ddd) }));
  const coup = ecA.length > 0
    ? ecA.reduce((best: any, p: any) => ((p.age ?? 999) < (best.age ?? 999) ? p : best))
    : null;
  const moy  = ecA.length > 0
    ? Math.round(ecA.reduce((s: number, p: any) => s + (p.age ?? 0), 0) / ecA.length)
    : 0;

  const progress = enCours.length / 10;

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
        <div className="year-pills" style={{ marginBottom: 32 }}>
          {years.map(y => (
            <button key={y} className={`year-pill${y === year ? " active" : ""}`}
              onClick={() => setYear(y)}>{y}
            </button>
          ))}
        </div>
      </div>

      {/* ── STATS BAND ── */}
      <div style={{
        display: "flex", alignItems: "stretch", justifyContent: "center",
        gap: 0, maxWidth: 700, margin: "0 auto 40px", padding: "0 20px",
      }}>
        {/* Points */}
        <StatBig
          value={totalPoints}
          label={`Point${totalPoints > 1 ? "s" : ""} en ${year}`}
          accent
          rounded="left"
        />

        {/* Jauge paris */}
        <div style={{
          flex: 2,
          background: "rgba(241,235,219,.03)",
          border: "1px solid rgba(241,235,219,.07)",
          borderLeft: "none", borderRight: "none",
          padding: "20px 24px",
          display: "flex", flexDirection: "column", justifyContent: "center", gap: 10,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{
              fontFamily: "'Outfit',sans-serif", fontSize: ".6rem",
              fontWeight: 300, letterSpacing: "2px",
              textTransform: "uppercase", color: "rgba(241,235,219,.3)",
            }}>
              Paris en cours
            </span>
            <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: "1.1rem", fontWeight: 800, color: "var(--cream)" }}>
              {enCours.length}
              <span style={{ fontSize: ".65rem", fontWeight: 300, color: "rgba(241,235,219,.3)" }}>/10</span>
            </span>
          </div>
          <div style={{ height: 4, background: "rgba(241,235,219,.08)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${progress * 100}%`, borderRadius: 4,
              background: progress >= 1
                ? "linear-gradient(90deg, var(--rose), var(--rose-deep))"
                : "linear-gradient(90deg, rgba(219,135,143,.6), rgba(219,135,143,.9))",
              transition: "width .6s cubic-bezier(.23,1,.32,1)",
            }} />
          </div>
        </div>

        {/* Moyenne d'âge */}
        <StatBig
          value={moy ? `${moy} ans` : "—"}
          label="Moyenne d'âge"
          rounded="none"
        />

        {/* Coup de poker */}
        {coup && (
          <StatBig
            value={coup.candidats.nom.split(" ").slice(-1)[0]}
            label={`Coup de poker · ${coup.age} ans`}
            rounded="right"
            small
          />
        )}
      </div>

      {/* ── CARTES ── */}
      <div style={{ padding: "0 24px 60px", maxWidth: 1200, margin: "0 auto" }}>

        <SectionHeader label="Paris en cours" count={enCours.length} max={10} />
        {enCours.length === 0 ? (
          <EmptySection label={`Aucun pari en cours pour ${year}.`} />
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center" }}>
            {enCours.map((p: any) => <CandidatCard key={p.id} candidat={p.candidats} />)}
          </div>
        )}

        <SectionHeader label="Paris gagnants" count={gagnants.length} style={{ marginTop: 60 }} />
        {gagnants.length === 0 ? (
          <EmptySection label={`Aucun pari gagnant en ${year}.`} />
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center" }}>
            {gagnants.map((p: any) => <CandidatCard key={p.id} candidat={p.candidats} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Composants locaux ───────────────────────────────────────────────────── */
function StatBig({ value, label, accent = false, rounded = "none", small = false }: {
  value: string | number; label: string;
  accent?: boolean; rounded?: "left" | "right" | "none"; small?: boolean;
}) {
  const r = { left: "12px 0 0 12px", right: "0 12px 12px 0", none: "0" };
  return (
    <div style={{
      flex: 1, minWidth: 110,
      background: accent ? "rgba(219,135,143,.1)" : "rgba(241,235,219,.03)",
      border: `1px solid ${accent ? "rgba(219,135,143,.22)" : "rgba(241,235,219,.07)"}`,
      borderRadius: r[rounded], padding: "20px 16px",
      textAlign: "center", display: "flex", flexDirection: "column",
      justifyContent: "center", gap: 4,
    }}>
      <div style={{
        fontFamily: "'Outfit',sans-serif",
        fontSize: small ? ".95rem" : "1.6rem",
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
      <h2 style={{
        fontFamily: "'Outfit',sans-serif", fontSize: "1rem",
        fontWeight: 700, color: "var(--cream)", margin: 0,
      }}>
        {label}
      </h2>
      <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(241,235,219,.12), transparent)" }} />
      <span style={{
        fontFamily: "'Outfit',sans-serif", fontSize: ".65rem", fontWeight: 600,
        color: "rgba(219,135,143,.6)",
        background: "rgba(219,135,143,.1)",
        border: "1px solid rgba(219,135,143,.2)",
        borderRadius: 20, padding: "3px 10px",
      }}>
        {count}{max ? `/${max}` : ""}
      </span>
    </div>
  );
}

function EmptySection({ label }: { label: string }) {
  return (
    <div style={{
      textAlign: "center", padding: "32px 0", marginBottom: 8,
      borderRadius: 16,
      background: "rgba(241,235,219,.02)",
      border: "1px dashed rgba(241,235,219,.08)",
    }}>
      <p style={{
        fontFamily: "'Outfit',sans-serif", fontSize: ".88rem",
        fontWeight: 300, color: "rgba(241,235,219,.3)",
      }}>
        {label}
      </p>
    </div>
  );
}