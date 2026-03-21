// app/salle-attente/page.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useSupabaseAuth } from "@/app/hooks/useSupabaseAuth";
import { useSearchCandidats } from "@/app/hooks/useSearchCandidats";
import CandidatCard from "@/app/components/CandidatCard";
import CandidatCardModal from "@/app/components/CandidatCardModal";
import { calculAge, pointsPourAge, formatNomCarte, formatFr } from "@/utils/fonctions";
import { Pari, CandidatRecherche } from "@/types";

/* ══ Carte de résultat de recherche (style panini complet) ═══════════════ */
function SearchResultCard({
  candidat,
  onClick,
  animDelay,
}: {
  candidat: CandidatRecherche;
  onClick: () => void;
  animDelay: number;
}) {
  const age  = calculAge(candidat.ddn, null);
  const pts  = pointsPourAge(age);
  const { display, fontSize, letterSpacing } = formatNomCarte(candidat.nom);
  const photoUrl = candidat.photo
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(candidat.photo.replace(/ /g, "_"))}`
    : null;

  return (
    <div
      onClick={onClick}
      style={{
        cursor: "pointer",
        opacity: 0,
        transform: "translateY(20px) scale(.96)",
        animation: `srCardIn .35s cubic-bezier(.23,1,.32,1) ${animDelay}ms forwards`,
      }}
    >
      <div
        className="panini-card"
        style={{ transition: "transform .3s cubic-bezier(.23,1,.32,1), box-shadow .3s ease" }}
        onMouseOver={e => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(-10px) scale(1.025)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(219,135,143,.25), 0 30px 80px rgba(0,0,0,.5)";
        }}
        onMouseOut={e => {
          (e.currentTarget as HTMLElement).style.transform = "";
          (e.currentTarget as HTMLElement).style.boxShadow = "";
        }}
      >
        <div className="pc-bg" />
        <div className="pc-strip">
          <span className="pc-vname" style={{ fontSize, letterSpacing }}>{display}</span>
        </div>
        <span className="pc-serial">#{String(candidat.wikidata_id?.replace("Q","")).padStart(4,"0")}</span>

        <div className="pc-photo-zone">
          <div className="pc-placeholder" id={`sr-ph-${candidat.id}`}>◆</div>
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={candidat.nom}
              onLoad={e => {
                (e.target as HTMLImageElement).style.display = "block";
                const ph = document.getElementById(`sr-ph-${candidat.id}`);
                if (ph) ph.style.display = "none";
              }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              style={{
                display: "none", position: "absolute", inset: 0,
                width: "100%", height: "100%",
                objectFit: "cover", objectPosition: "center top",
              }}
            />
          )}
        </div>

        <div className="pc-pts">
          <span className="pn">{pts}</span>
          <span className="pl">pts</span>
        </div>

        <div className="pc-info">
          <div className="pc-dates">
            <div className="pc-date-item">
              <span className="pc-date-lbl">Naissance</span>
              <span className="pc-date-val">{formatFr(candidat.ddn)}</span>
            </div>
          </div>
          {age !== null && <div className="pc-age">{age} ans</div>}
          {candidat.description && (
            <p style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: ".5rem", fontWeight: 300,
              color: "rgba(241,235,219,.38)",
              fontStyle: "italic", lineHeight: 1.4,
              marginTop: 3,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            } as React.CSSProperties}>
              {candidat.description.charAt(0).toUpperCase() + candidat.description.slice(1)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══ OVERLAY DE RECHERCHE ════════════════════════════════════════════════ */
function SearchOverlay({
  onSelect,
  onClose,
}: {
  onSelect: (c: CandidatRecherche) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { suggestions, loading } = useSearchCandidats(query);

  useEffect(() => {
    // Focus auto sur le champ dès l'ouverture
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // Echap pour fermer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSelect = (c: CandidatRecherche) => {
    onSelect(c);
    onClose();
  };

  const hasQuery    = query.trim().length >= 2;
  const hasResults  = suggestions.length > 0;

  return (
    <>
      <style>{`
        @keyframes srOverlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes srPanelIn {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes srCardIn {
          from { opacity: 0; transform: translateY(20px) scale(.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .sr-input:focus { outline: none; }
        .sr-input::placeholder { color: rgba(241,235,219,.25); }
        .sr-input:-webkit-autofill { -webkit-box-shadow: 0 0 0 999px rgba(13,13,24,0) inset !important; }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 800,
          background: "rgba(8,8,16,.92)",
          backdropFilter: "blur(12px)",
          animation: "srOverlayIn .25s ease forwards",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 900,
          display: "flex", flexDirection: "column", alignItems: "center",
          paddingTop: 80,
          animation: "srPanelIn .3s cubic-bezier(.23,1,.32,1) forwards",
          pointerEvents: "none",
        }}
      >
        {/* Champ de recherche géant */}
        <div
          style={{
            width: "100%", maxWidth: 680,
            padding: "0 24px",
            pointerEvents: "auto",
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ position: "relative" }}>
            {/* Requête en grand en filigrane */}
            {query && (
              <div style={{
                position: "absolute",
                top: "50%", left: 0, right: 48,
                transform: "translateY(-50%)",
                fontFamily: "'Outfit', sans-serif",
                fontSize: "clamp(2.5rem, 8vw, 5rem)",
                fontWeight: 900,
                letterSpacing: "-2px",
                color: "rgba(241,235,219,.04)",
                pointerEvents: "none",
                userSelect: "none",
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "clip",
              }}>
                {query}
              </div>
            )}

            <input
              ref={inputRef}
              className="sr-input"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher une personnalité vivante…"
              autoComplete="off"
              style={{
                width: "100%",
                padding: "20px 56px 20px 0",
                fontFamily: "'Outfit', sans-serif",
                fontSize: "clamp(1.4rem, 4vw, 2.2rem)",
                fontWeight: 700,
                letterSpacing: "-0.5px",
                background: "transparent",
                border: "none",
                borderBottom: "2px solid rgba(219,135,143,.4)",
                color: "var(--cream)",
                caretColor: "var(--rose)",
              }}
            />

            {/* Indicateur de chargement / icône */}
            <div style={{
              position: "absolute", right: 4, top: "50%",
              transform: "translateY(-50%)",
            }}>
              {loading ? (
                <div style={{
                  width: 20, height: 20,
                  border: "2px solid rgba(219,135,143,.25)",
                  borderTopColor: "var(--rose)",
                  borderRadius: "50%",
                  animation: "hSpin .7s linear infinite",
                }} />
              ) : (
                <span style={{ color: "rgba(241,235,219,.2)", fontSize: "1.4rem" }}>⌕</span>
              )}
            </div>
          </div>

          {/* Hint sous la barre */}
          <p style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: ".62rem", fontWeight: 300,
            letterSpacing: "2px", textTransform: "uppercase",
            color: "rgba(241,235,219,.2)",
            marginTop: 10,
            textAlign: "right",
          }}>
            Échap pour fermer
          </p>
        </div>

        {/* Résultats en cartes */}
        {hasQuery && (
          <div
            style={{ pointerEvents: "auto", width: "100%", marginTop: 32 }}
            onClick={e => e.stopPropagation()}
          >
            {hasResults ? (
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 20,
                justifyContent: "center",
                padding: "0 24px 60px",
                maxWidth: 1200,
                margin: "0 auto",
              }}>
                {suggestions.map((c, i) => (
                  <SearchResultCard
                    key={c.id}
                    candidat={c}
                    onClick={() => handleSelect(c)}
                    animDelay={i * 60}
                  />
                ))}
              </div>
            ) : !loading && (
              <p style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: ".78rem", fontWeight: 300,
                letterSpacing: "2px", textTransform: "uppercase",
                color: "rgba(241,235,219,.25)",
                textAlign: "center",
                marginTop: 40,
              }}>
                Aucune personnalité vivante trouvée
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ══ PAGE PRINCIPALE ═════════════════════════════════════════════════════ */
export default function SalleAttente() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const [profile,       setProfile]       = useState<{ display_name: string } | null>(null);
  const [paris,         setParis]         = useState<Pari[]>([]);
  const [selectedYear,  setSelectedYear]  = useState<number>(new Date().getFullYear());
  const [years,         setYears]         = useState<number[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [screenW,      setScreenW]      = useState(800);

  useEffect(() => {
    const check = () => setScreenW(window.innerWidth);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const [selected,      setSelected]      = useState<CandidatRecherche | null>(null);
  const yearInitialized = useRef(false);

  const loadParis = useCallback(async (userId: string) => {
    const { data, error: e } = await supabase.from("paris")
      .select("id, mort, saison, candidat_id, candidats ( id, nom, ddn, ddd, description, photo, wikidata_id )")
      .eq("joueur", userId);
    if (e) throw e;
    const data_ = (data ?? []) as unknown as Pari[];
    setParis(data_);
    const cur = new Date().getFullYear();
    const uy = [...new Set(data_.map(p => p.saison))].sort((a, b) => b - a);
    if (!uy.includes(cur)) uy.unshift(cur);
    setYears(uy);
    if (!yearInitialized.current) { setSelectedYear(cur); yearInitialized.current = true; }
  }, []);

  const doInit = useCallback(async (userId: string) => {
    setError(null); setLoading(true);
    try {
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
      setProfile(prof);
      await loadParis(userId);
    } catch { setError("Impossible de charger ta salle d'attente."); }
    finally { setLoading(false); }
  }, [loadParis]);

  useEffect(() => {
    if (!authLoading && user) doInit(user.id);
    else if (!authLoading && !user) setLoading(false);
  }, [authLoading, user, doInit]);

  const handleAdded = async () => {
    setSelected(null);
    if (user) { try { await loadParis(user.id); } catch {} }
  };

  if (authLoading || loading) return <div className="page-loading">Chargement…</div>;
  if (error) return (
    <div className="page-error">
      <p>{error}</p>
      <button className="btn-retry" onClick={() => user && doInit(user.id)}>Réessayer</button>
    </div>
  );
  if (!user) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ fontFamily:"'Outfit',sans-serif", color:"rgba(241,235,219,.35)", fontSize:".88rem" }}>
        Tu dois être connecté pour voir cette page.
      </p>
    </div>
  );

  const parisForYear   = paris.filter(p => p.saison === selectedYear);
  const enCours        = parisForYear.filter(p => { const d = p.candidats?.ddd; return !d || new Date(d).getFullYear() > selectedYear; });
  const gagnants       = parisForYear.filter(p => { const d = p.candidats?.ddd; return d && new Date(d).getFullYear() === selectedYear; });
  const enCoursAvecAge = enCours.map(p => ({ ...p, age: calculAge(p.candidats.ddn, p.candidats.ddd) }));
  const totalPoints    = gagnants.reduce((s, p) => s + pointsPourAge(calculAge(p.candidats.ddn, p.candidats.ddd)), 0);
  const coupDePoker    = enCoursAvecAge.length > 0 ? enCoursAvecAge.reduce((y, p) => ((p.age ?? 999) < (y.age ?? 999) ? p : y)) : null;
  const moyenneAge     = enCoursAvecAge.length > 0 ? Math.round(enCoursAvecAge.reduce((s, p) => s + (p.age ?? 0), 0) / enCoursAvecAge.length) : 0;
  const existingIds    = parisForYear.map(p => p.candidats?.wikidata_id).filter(Boolean) as string[];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* ── OVERLAY DE RECHERCHE ── */}
      {searchOpen && (
        <SearchOverlay
          onSelect={c => setSelected(c)}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {/* ── EN-TÊTE ── */}
      <div style={{ padding: "48px 0 0", textAlign: "center" }}>
        <h1 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: "clamp(2rem,5vw,3.2rem)",
          fontWeight: 900, lineHeight: 1,
          letterSpacing: "-1px", color: "var(--cream)",
          marginBottom: 6,
        }}>
          Ma salle d&apos;attente
        </h1>
        {profile && (
          <p style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: ".65rem", fontWeight: 300,
            letterSpacing: "5px", textTransform: "uppercase",
            color: "rgba(219,135,143,.5)", marginBottom: 28,
          }}>
            {profile.display_name}
          </p>
        )}

        <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center", marginBottom:32, padding:"0 16px" }}>
          {years.map(y => (
            <button key={y} onClick={() => setSelectedYear(y)} style={{
              padding:"7px 18px", borderRadius:30, cursor:"pointer", flexShrink:0,
              fontFamily:"'Outfit',sans-serif", fontSize:".7rem", fontWeight:500, letterSpacing:"1.5px", textTransform:"uppercase",
              border: y===selectedYear ? "1px solid rgba(219,135,143,.7)" : "1px solid rgba(241,235,219,.15)",
              background: y===selectedYear ? "rgba(219,135,143,.15)" : "transparent",
              color: y===selectedYear ? "var(--rose)" : "rgba(241,235,219,.4)",
              transition:"all .22s ease",
            }}>{y}</button>
          ))}
        </div>
      </div>

      {/* ── STATS ── grille responsive ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: coupDePoker ? "1fr 1fr" : "1fr 1fr",
        gap: 10,
        maxWidth: 500,
        margin: "0 auto 36px",
        padding: "0 16px",
      }}>
        <StatTile value={totalPoints} label={`Pt${totalPoints > 1 ? "s" : ""} en ${selectedYear}`} accent />
        <StatTile value={moyenneAge ? `${moyenneAge} ans` : "—"} label="Moyenne d\'âge" />
        {coupDePoker && (
          <StatTile
            value={coupDePoker.candidats.nom.split(" ").slice(-1)[0]}
            label={`Coup de poker · ${coupDePoker.age} ans`}
            small
            wide
          />
        )}
      </div>

      {/* ── BOUTON RECHERCHE ── */}
      <div style={{ maxWidth: 480, margin: "0 auto 52px", padding: "0 20px" }}>
        <p style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: ".6rem", fontWeight: 300,
          letterSpacing: "3px", textTransform: "uppercase",
          color: "rgba(241,235,219,.25)",
          textAlign: "center", marginBottom: 12,
        }}>
          Ajouter un candidat
        </p>
        <button
          onClick={() => setSearchOpen(true)}
          style={{
            width: "100%", padding: "16px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontFamily: "'Outfit', sans-serif", fontSize: ".9rem", fontWeight: 400,
            background: "rgba(241,235,219,.04)",
            border: "1px solid rgba(241,235,219,.12)",
            borderRadius: 40, color: "rgba(241,235,219,.3)",
            cursor: "pointer",
            transition: "border-color .2s, background .2s, color .2s",
          }}
          onMouseOver={e => {
            const el = e.currentTarget;
            el.style.borderColor = "rgba(219,135,143,.45)";
            el.style.background  = "rgba(241,235,219,.06)";
            el.style.color       = "rgba(241,235,219,.5)";
          }}
          onMouseOut={e => {
            const el = e.currentTarget;
            el.style.borderColor = "rgba(241,235,219,.12)";
            el.style.background  = "rgba(241,235,219,.04)";
            el.style.color       = "rgba(241,235,219,.3)";
          }}
        >
          <span>Rechercher une personnalité vivante…</span>
          <span style={{ color: "rgba(241,235,219,.2)", fontSize: "1.1rem" }}>⌕</span>
        </button>
      </div>

      {/* ── CARTES ── */}
      <div style={{ padding: "0 24px 60px", maxWidth: 1200, margin: "0 auto" }}>
        <SectionHeader label="Paris en cours" count={enCours.length} max={10} />
        {enCours.length === 0 ? (
          <EmptySection label={`Aucun pari en cours pour ${selectedYear}.`} cta="Clique sur le champ ci-dessus pour ajouter une personnalité." />
        ) : (
          <CardGrid items={enCours.map(p => p.candidats)} screenW={screenW} />
        )}

        <SectionHeader label="Paris gagnants" count={gagnants.length} style={{ marginTop: 60 }} />
        {gagnants.length === 0 ? (
          <EmptySection label={`Aucun pari gagnant en ${selectedYear} pour l'instant.`} />
        ) : (
          <CardGrid items={gagnants.map(p => p.candidats)} screenW={screenW} />
        )}
      </div>

      {selected && (
        <CandidatCardModal
          candidat={selected}
          onClose={() => setSelected(null)}
          user={user}
          saison={selectedYear}
          parisEnCours={enCours.length}
          existingPariIds={existingIds}
          onCandidatAdded={handleAdded}
        />
      )}
    </div>
  );
}

/* ── Grille de cartes : 2 colonnes sur mobile avec scale, flex sur desktop ── */
function CardGrid({ items, screenW }: { items: any[]; screenW: number }) {
  const CARD_W    = 210;
  const CARD_H    = 300;
  const GAP       = 12;
  const PAD       = 32; // padding total gauche+droite
  const COLS      = 2;
  // Espace disponible pour 2 cartes + 1 gap
  const available = screenW - PAD - GAP;
  const colW      = available / COLS;
  // Scale pour que la carte tienne dans la colonne
  const scale     = colW < CARD_W ? Math.max(0.45, colW / CARD_W) : 1;
  const isMobile  = scale < 1;

  if (!isMobile) {
    // Desktop : flex wrap centré normal
    return (
      <div style={{ display:"flex", flexWrap:"wrap", gap:20, justifyContent:"center", marginBottom:8 }}>
        {items.map((c: any) => <CandidatCard key={c.id} candidat={c} />)}
      </div>
    );
  }

  // Mobile : grille 2 colonnes avec scale
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
        <div key={cand.id} style={{ width: scaledW, height: scaledH, position:"relative", overflow:"visible" }}>
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
    <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:24, ...s }}>
      <h2 style={{ fontFamily:"'Outfit',sans-serif", fontSize:"1rem", fontWeight:700, color:"var(--cream)", margin:0 }}>{label}</h2>
      <div style={{ flex:1, height:1, background:"linear-gradient(90deg, rgba(241,235,219,.12), transparent)" }} />
      <span style={{ fontFamily:"'Outfit',sans-serif", fontSize:".65rem", fontWeight:600, color:"rgba(219,135,143,.6)", background:"rgba(219,135,143,.1)", border:"1px solid rgba(219,135,143,.2)", borderRadius:20, padding:"3px 10px" }}>
        {count}{max ? `/${max}` : ""}
      </span>
    </div>
  );
}

function EmptySection({ label, cta }: { label: string; cta?: string }) {
  return (
    <div style={{ textAlign:"center", padding:"32px 0", borderRadius:16, background:"rgba(241,235,219,.02)", border:"1px dashed rgba(241,235,219,.08)", marginBottom:8 }}>
      <p style={{ fontFamily:"'Outfit',sans-serif", fontSize:".88rem", fontWeight:300, color:"rgba(241,235,219,.3)" }}>{label}</p>
      {cta && <p style={{ fontFamily:"'Outfit',sans-serif", fontSize:".72rem", fontWeight:300, color:"rgba(241,235,219,.18)", marginTop:6 }}>{cta}</p>}
    </div>
  );
}