// app/classement/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { pointsPourAge, calculAge } from "@/utils/fonctions";
import CandidatCardModal from "@/app/components/CandidatCardModal";
import { CandidatRecherche } from "@/types";

interface CandidatGagnant {
  id: number;
  nom: string;
  ddn: string | null;
  ddd: string | null;
  photo?: string;
  wikidata_id?: string;
  description?: string;
}

interface Score {
  user_id: string;
  display_name: string;
  totalPoints: number;
  parisGagnants: number;
  candidatsGagnants: CandidatGagnant[];
}

/* ── Avatar circulaire cliquable ──────────────────────────────────────────── */
function Avatar({ c, isFirst, onClick }: {
  c: CandidatGagnant;
  isFirst: boolean;
  onClick: () => void;
}) {
  const borderColor = isFirst ? "rgba(200,175,90,.5)" : "rgba(219,135,143,.4)";
  const photoUrl = c.photo
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(c.photo.replace(/ /g, "_"))}`
    : null;

  return (
    <div
      onClick={onClick}
      title={c.nom}
      style={{
        width: 36, height: 36, borderRadius: "50%",
        border: `2px solid ${borderColor}`,
        overflow: "hidden",
        cursor: "pointer",
        background: "rgba(241,235,219,.06)",
        flexShrink: 0,
        transition: "transform .2s ease, border-color .2s ease",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onMouseOver={e => {
        (e.currentTarget as HTMLElement).style.transform = "scale(1.15)";
        (e.currentTarget as HTMLElement).style.borderColor = isFirst ? "rgba(200,175,90,.9)" : "rgba(219,135,143,.9)";
        (e.currentTarget as HTMLElement).style.zIndex = "10";
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLElement).style.transform = "scale(1)";
        (e.currentTarget as HTMLElement).style.borderColor = borderColor;
        (e.currentTarget as HTMLElement).style.zIndex = "1";
      }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={c.nom}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
          onError={e => {
            const el = e.currentTarget;
            el.style.display = "none";
            el.parentElement!.innerHTML = `<span style="font-size:.6rem;color:rgba(241,235,219,.4)">${c.nom[0]}</span>`;
          }}
        />
      ) : (
        <span style={{ fontSize: ".6rem", color: "rgba(241,235,219,.5)", fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>
          {c.nom[0]}
        </span>
      )}
    </div>
  );
}

/* ── Groupe d'avatars avec overflow "+N" ──────────────────────────────────── */
const MAX_VISIBLE = 5;

function AvatarGroup({ candidats, isFirst, onSelect }: {
  candidats: CandidatGagnant[];
  isFirst: boolean;
  onSelect: (c: CandidatGagnant) => void;
}) {
  if (candidats.length === 0) {
    return (
      <p style={{
        fontFamily: "'Outfit', sans-serif",
        fontSize: ".62rem", fontWeight: 300,
        color: "rgba(241,235,219,.25)",
        fontStyle: "italic",
        textAlign: "center",
      }}>
        Aucun pari gagnant
      </p>
    );
  }

  const visible  = candidats.slice(0, MAX_VISIBLE);
  const overflow = candidats.length - MAX_VISIBLE;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: -6, flexWrap: "nowrap" }}>
      {/* Chevauchement léger grâce à margin-left négatif */}
      <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
        {visible.map((c, i) => (
          <div key={c.id} style={{ marginLeft: i === 0 ? 0 : -10, position: "relative", zIndex: MAX_VISIBLE - i }}>
            <Avatar c={c} isFirst={isFirst} onClick={() => onSelect(c)} />
          </div>
        ))}
        {overflow > 0 && (
          <div style={{
            marginLeft: -10, position: "relative", zIndex: 0,
            width: 36, height: 36, borderRadius: "50%",
            border: `2px solid ${isFirst ? "rgba(200,175,90,.3)" : "rgba(219,135,143,.3)"}`,
            background: "rgba(241,235,219,.06)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: ".55rem", fontWeight: 700,
              color: isFirst ? "rgba(200,175,90,.7)" : "rgba(219,135,143,.7)",
            }}>
              +{overflow}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Page principale ──────────────────────────────────────────────────────── */
export default function Classement() {
  const [cl,      setCl]      = useState<Record<number, Score[]>>({});
  const [years,   setYears]   = useState<number[]>([]);
  const [year,    setYear]    = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [modal,   setModal]   = useState<CandidatRecherche | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: profs } = await supabase.from("profiles").select("user_id, display_name");
        const seen = new Set<string>();
        const profiles = (profs ?? []).filter(p => {
          if (seen.has(p.user_id)) return false;
          seen.add(p.user_id); return true;
        });

        // Récupère aussi photo et wikidata_id pour les avatars
        const { data: paris } = await supabase
          .from("paris")
          .select("id, joueur, saison, candidat_id, candidats ( id, nom, ddn, ddd, photo, wikidata_id, description )");

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
          const sm: Record<string, { points: number; wins: number; candidats: CandidatGagnant[] }> = {};

          byYear[annee].forEach((p: any) => {
            const c = p.candidats;
            if (!c?.ddd || new Date(c.ddd).getFullYear() !== annee) return;
            const pts = pointsPourAge(calculAge(c.ddn, c.ddd));
            if (!sm[p.joueur]) sm[p.joueur] = { points: 0, wins: 0, candidats: [] };
            sm[p.joueur].points += pts;
            sm[p.joueur].wins   += 1;
            sm[p.joueur].candidats.push({
              id: c.id, nom: c.nom, ddn: c.ddn, ddd: c.ddd,
              photo: c.photo, wikidata_id: c.wikidata_id, description: c.description,
            });
          });

          const jo = new Set(byYear[annee].map((p: any) => p.joueur));
          classements[annee] = profiles
            .filter(p => jo.has(p.user_id))
            .map(p => {
              const s = sm[p.user_id] || { points: 0, wins: 0, candidats: [] };
              return {
                user_id: p.user_id,
                display_name: p.display_name || "Joueur inconnu",
                totalPoints: s.points,
                parisGagnants: s.wins,
                candidatsGagnants: s.candidats,
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

  // Conversion CandidatGagnant → CandidatRecherche pour la modal
  const openModal = (c: CandidatGagnant) => {
    setModal({
      id: String(c.id),
      nom: c.nom,
      ddn: c.ddn ?? "",
      ddd: c.ddd ?? null,        // ← null et non undefined
      photo: c.photo ?? "",
      description: c.description ?? "",   // ← description si dispo
      wikidata_id: c.wikidata_id ?? String(c.id),
    } as any);
  };

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
  const top3   = classement.slice(0, 3);
  const rest   = classement.slice(3);
  const maxPts = Math.max(classement[0]?.totalPoints ?? 1, 1);

  // Ordre podium : [2e, 1er, 3e] — alignés par le bas, socles de hauteurs différentes
  const podiumOrder: Array<{ joueur: Score; rank: number; socleH: number }> =
    top3.length === 3
      ? [
          { joueur: top3[1], rank: 1, socleH: 56  },
          { joueur: top3[0], rank: 0, socleH: 100 },
          { joueur: top3[2], rank: 2, socleH: 36  },
        ]
      : top3.map((j, i) => ({ joueur: j, rank: i, socleH: 80 - i * 20 }));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>

      {/* ── EN-TÊTE ── */}
      <div style={{ padding: "48px 24px 0", textAlign: "center" }}>
        <h1 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: "clamp(2rem,5vw,3.2rem)",
          fontWeight: 900, lineHeight: 1,
          letterSpacing: "-1px", color: "var(--cream)", marginBottom: 6,
        }}>
          Classement
        </h1>
        <p style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: ".65rem", fontWeight: 300,
          letterSpacing: "5px", textTransform: "uppercase",
          color: "rgba(219,135,143,.45)", marginBottom: 28,
        }}>
          Saison {year}
        </p>
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 8,
          justifyContent: "center", marginBottom: 32,
          overflowX: "auto", WebkitOverflowScrolling: "touch" as const,
          scrollbarWidth: "none" as const, padding: "0 4px",
        }}>
          {years.map(y => (
            <button key={y} className={`year-pill${y === year ? " active" : ""}`}
              style={{ flexShrink: 0 }}
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
          {/* ── PODIUM ── */}
          {top3.length > 0 && (
            <div style={{
              maxWidth: 700, margin: "40px auto 0", padding: "0 16px",
              display: "flex",
              alignItems: "flex-end",   // ← tous alignés par le bas
              justifyContent: "center",
              gap: 8,
            }}>
              {podiumOrder.map(({ joueur, rank, socleH }) => {
                const isFirst  = rank === 0;
                const gold     = "rgba(200,175,90,.9)";
                const rose     = "var(--rose)";
                const color    = isFirst ? gold : rose;
                const pct      = Math.round((joueur.totalPoints / maxPts) * 100);

                return (
                  <div key={joueur.user_id} style={{
                    flex: 1,
                    display: "flex", flexDirection: "column", alignItems: "center",
                    // Pas de translateY — l'alignement flex-end + hauteur de socle fait tout
                  }}>

                    {/* Numéro ghost */}
                    <div style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: isFirst ? "4rem" : "2.8rem",
                      fontWeight: 900, lineHeight: 1,
                      color: isFirst ? "rgba(200,175,90,.1)" : "rgba(219,135,143,.09)",
                      letterSpacing: "-3px",
                      alignSelf: "flex-start", paddingLeft: 4,
                      marginBottom: -8, userSelect: "none",
                    }}>
                      {String(rank + 1).padStart(2, "0")}
                    </div>

                    {/* Score + barre */}
                    <div style={{ textAlign: "center", marginBottom: 10, width: "100%" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 3, justifyContent: "center" }}>
                        <span style={{
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: isFirst ? "2.2rem" : "1.5rem",
                          fontWeight: 900, lineHeight: 1, color,
                        }}>
                          {joueur.totalPoints}
                        </span>
                        <span style={{
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: ".58rem", fontWeight: 300,
                          color: "rgba(241,235,219,.22)",
                          letterSpacing: "1px", textTransform: "uppercase",
                        }}>
                          pt{joueur.totalPoints > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div style={{ height: isFirst ? 3 : 2, background: "rgba(241,235,219,.07)", borderRadius: 4, overflow: "hidden", margin: "6px 0" }}>
                        <div style={{
                          height: "100%", width: `${pct}%`, borderRadius: 4,
                          background: isFirst
                            ? "linear-gradient(90deg, #c8af5a, #a08c3a)"
                            : "linear-gradient(90deg, var(--rose), var(--rose-deep))",
                          transition: "width .8s cubic-bezier(.23,1,.32,1)",
                        }} />
                      </div>
                    </div>

                    {/* Pseudo au-dessus du socle */}
                    <Link
                      href={`/joueur/${joueur.user_id}`}
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: isFirst ? ".88rem" : ".75rem",
                        fontWeight: 700, color,
                        textDecoration: "none",
                        textAlign: "center", lineHeight: 1.2,
                        marginBottom: 8, display: "block",
                      }}
                    >
                      {joueur.display_name}
                    </Link>

                    {/* Socle : avatars des candidats gagnants */}
                    <div style={{
                      width: "100%",
                      minHeight: socleH,
                      background: isFirst ? "rgba(200,175,90,.08)" : "rgba(219,135,143,.07)",
                      border: `1px solid ${isFirst ? "rgba(200,175,90,.2)" : "rgba(219,135,143,.18)"}`,
                      borderRadius: "12px 12px 0 0",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "12px 8px",
                    }}>
                      <AvatarGroup
                        candidats={joueur.candidatsGagnants}
                        isFirst={isFirst}
                        onSelect={openModal}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── SUITE ── */}
          {rest.length > 0 && (
            <div style={{ maxWidth: 600, margin: "32px auto 0", padding: "0 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: "rgba(241,235,219,.07)" }} />
                <span style={{ fontFamily:"'Outfit',sans-serif", fontSize:".55rem", fontWeight:300, letterSpacing:"3px", textTransform:"uppercase", color:"rgba(241,235,219,.2)" }}>
                  Suite
                </span>
                <div style={{ flex: 1, height: 1, background: "rgba(241,235,219,.07)" }} />
              </div>

              {rest.map((joueur, i) => {
                const rank = i + 4;
                const pct  = Math.round((joueur.totalPoints / maxPts) * 100);
                const hasWins = joueur.candidatsGagnants.length > 0;

                return (
                  <div key={joueur.user_id}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "12px 16px", borderRadius: 12,
                      background: "rgba(241,235,219,.02)",
                      border: "1px solid rgba(241,235,219,.05)",
                      marginBottom: 6, transition: "background .15s",
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = "rgba(241,235,219,.04)")}
                    onMouseOut={e  => (e.currentTarget.style.background = "rgba(241,235,219,.02)")}
                  >
                    {/* Rang */}
                    <span style={{ fontFamily:"'Outfit',sans-serif", fontSize:".68rem", fontWeight:700, color:"rgba(241,235,219,.2)", minWidth:24, textAlign:"right", flexShrink:0 }}>
                      {rank}
                    </span>

                    {/* Nom + barre */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/joueur/${joueur.user_id}`}
                        style={{ fontFamily:"'Outfit',sans-serif", fontSize:".88rem", fontWeight:600, color:"var(--rose)", textDecoration:"none" }}
                        onMouseOver={e => (e.currentTarget.style.color = "var(--cream)")}
                        onMouseOut={e  => (e.currentTarget.style.color = "var(--rose)")}
                      >
                        {joueur.display_name}
                      </Link>
                      <div style={{ height:2, background:"rgba(241,235,219,.06)", borderRadius:4, overflow:"hidden", marginTop:5 }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:"rgba(241,235,219,.15)", borderRadius:4 }} />
                      </div>
                    </div>

                    {/* Avatars OU vide */}
                    {hasWins ? (
                      <div style={{ flexShrink: 0 }}>
                        <AvatarGroup
                          candidats={joueur.candidatsGagnants}
                          isFirst={false}
                          onSelect={openModal}
                        />
                      </div>
                    ) : (
                      <span style={{ fontFamily:"'Outfit',sans-serif", fontSize:".58rem", fontWeight:300, color:"rgba(241,235,219,.18)", flexShrink:0 }}>
                        —
                      </span>
                    )}

                    {/* Score */}
                    <div style={{ textAlign:"right", flexShrink:0, minWidth:40 }}>
                      <span style={{ fontFamily:"'Outfit',sans-serif", fontSize:"1.05rem", fontWeight:800, color:"rgba(241,235,219,.55)" }}>
                        {joueur.totalPoints}
                      </span>
                      <span style={{ fontFamily:"'Outfit',sans-serif", fontSize:".5rem", fontWeight:300, color:"rgba(241,235,219,.2)", letterSpacing:"1px", textTransform:"uppercase", marginLeft:3 }}>
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

      {/* ── MODAL candidat ── */}
      {modal && (
        <div
          style={{ position:"fixed", inset:0, background:"rgba(8,8,16,.88)", backdropFilter:"blur(8px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
          onClick={() => setModal(null)}
        >
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}
            onClick={e => e.stopPropagation()}>
            <CandidatCardModal candidat={modal} onClose={() => setModal(null)} />
            <button
              onClick={() => setModal(null)}
              style={{ padding:"8px 22px", background:"transparent", border:"1px solid rgba(241,235,219,.14)", borderRadius:30, color:"rgba(241,235,219,.38)", fontFamily:"'Outfit',sans-serif", fontSize:".7rem", fontWeight:500, letterSpacing:2, textTransform:"uppercase", cursor:"pointer" }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
