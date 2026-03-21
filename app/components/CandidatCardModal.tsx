// app/components/CandidatCardModal.tsx
"use client";

import { User } from "@supabase/supabase-js";
import { calculAge, pointsPourAge, capitalizeFirst, formatNomCarte, formatFr } from "@/utils/fonctions";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAddCandidat } from "@/app/hooks/useAddCandidat";
import { CandidatRecherche } from "@/types";
import Link from "next/link";

interface CandidatCardModalProps {
  candidat: CandidatRecherche;
  onClose: () => void;
  user?: User | null;
  saison?: number;
  parisEnCours?: number;
  existingPariIds?: string[];
  onCandidatAdded?: () => void;
}

export default function CandidatCardModal({
  candidat, onClose, user, saison, parisEnCours, existingPariIds, onCandidatAdded,
}: CandidatCardModalProps) {
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const { addCandidat, loading: adding } = useAddCandidat(user?.id);

  // Vérifie si le candidat existe en base pour afficher le serial et le lien fiche
  const [dbId, setDbId] = useState<number | null>(null);
  useEffect(() => {
    if (!candidat.wikidata_id) return;
    supabase
      .from("candidats")
      .select("id")
      .eq("wikidata_id", candidat.wikidata_id)
      .maybeSingle()
      .then(({ data }) => { if (data) setDbId(data.id); });
  }, [candidat.wikidata_id]);

  const ddd    = (candidat as any).ddd ?? null;
  const isDead = !!ddd;
  const age    = calculAge(candidat.ddn, ddd);
  const points = pointsPourAge(age);
  const currentYear = saison ?? new Date().getFullYear();
  const canAdd      = !!user && !isDead && (parisEnCours !== undefined ? parisEnCours < 10 : true);
  const alreadyAdded = existingPariIds?.includes(candidat.wikidata_id);
  const showButton   = user && !alreadyAdded && canAdd;
  const disabledMsg  = alreadyAdded ? "Déjà dans ta salle d'attente" : !canAdd ? "Tu as déjà 10 candidats" : null;

  const photoUrl = candidat.photo
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(candidat.photo.replace(/ /g, "_"))}`
    : null;

  const { display, fontSize, letterSpacing } = formatNomCarte(candidat.nom);

  const ajouterPari = () => {
    if (!user)        { setMessage("Tu dois être connecté pour ajouter un pari !"); return; }
    if (!canAdd)      { setMessage("Tu as déjà 10 paris cette année !"); return; }
    if (alreadyAdded) { setMessage("Tu as déjà parié sur ce candidat cette année !"); return; }
    setShowConfirm(true);
  };

  const confirmerAjout = async () => {
    setShowConfirm(false); setMessage("");
    const result = await addCandidat(candidat, currentYear);
    if (result.success) {
      setMessage("✅ Pari ajouté avec succès !");
      onCandidatAdded?.();
      setTimeout(onClose, 1500);
    } else {
      setMessage(`❌ ${result.error}`);
    }
  };

  return (
    <>
      {/* ── BACKDROP ── */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(8,8,16,.88)", backdropFilter: "blur(8px)",
          zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
          animation: "fadeUp .25s ease",
        }}
      >
        {/* ── CARTE CENTRALE ── */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
            transform: "scale(1)",
            animation: "modalIn .3s cubic-bezier(.23,1,.32,1)",
          }}
        >
          {/* La carte panini agrandie */}
          <div
            className={`panini-card${isDead ? " dead" : ""}`}
            style={{ width: 250, height: 360, "--strip-w": "40px" } as React.CSSProperties}
          >
            <div className="pc-bg" />
            <div className="pc-strip">
              <span className="pc-vname" style={{ fontSize, letterSpacing }}>{display}</span>
            </div>
            <span className="pc-serial">
              {dbId !== null ? `#${String(dbId).padStart(4, "0")}` : ""}
            </span>

            {/* Photo */}
            <div className="pc-photo-zone" style={{ height: 220 }}>
              {photoUrl ? (
                <>
                  <div className="pc-placeholder" id="modal-ph">◆</div>
                  <img
                    src={photoUrl}
                    alt={candidat.nom}
                    onLoad={e => {
                      (e.target as HTMLImageElement).style.display = "block";
                      const ph = document.getElementById("modal-ph");
                      if (ph) ph.style.display = "none";
                    }}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    style={{ display: "none", position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
                  />
                </>
              ) : (
                <div className="pc-placeholder">◆</div>
              )}
            </div>

            {/* Points */}
            <div className="pc-pts" style={{ top: 202, width: 48, height: 48 }}>
              <span className="pn" style={{ fontSize: "1.15rem" }}>{points}</span>
              <span className="pl">pts</span>
            </div>

            {/* Infos */}
            <div className="pc-info">
              <div className="pc-dates">
                <div className="pc-date-item">
                  <span className="pc-date-lbl">Naissance</span>
                  <span className="pc-date-val" style={{ fontSize: ".78rem" }}>{formatFr(candidat.ddn)}</span>
                </div>
                {isDead && (
                  <>
                    <span className="pc-sep">→</span>
                    <div className="pc-date-item">
                      <span className="pc-date-lbl">Décès</span>
                      <span className="pc-date-val" style={{ fontSize: ".78rem" }}>{formatFr(ddd)}</span>
                    </div>
                  </>
                )}
              </div>
              {age !== null && (
                <div className="pc-age" style={{ fontSize: ".6rem" }}>{age} ans</div>
              )}
              {candidat.description && (
                <p style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: ".55rem", fontWeight: 300,
                  color: "rgba(241,235,219,.4)",
                  fontStyle: "italic",
                  lineHeight: 1.5,
                  marginTop: 4,
                }}>
                  {capitalizeFirst(candidat.description)}
                </p>
              )}
            </div>
          </div>

          {/* ── Bouton ajouter / message ── */}
          {user && (
            <div style={{ width: 250, display: "flex", flexDirection: "column", gap: 8 }}>
              {showButton && (
                <button
                  onClick={ajouterPari}
                  disabled={adding}
                  style={{
                    width: "100%", padding: "13px",
                    background: adding ? "rgba(219,135,143,.4)" : "var(--rose)",
                    color: "#0d0d18", border: "none", borderRadius: 12,
                    fontFamily: "'Outfit', sans-serif", fontSize: ".78rem", fontWeight: 700,
                    letterSpacing: "2px", textTransform: "uppercase",
                    cursor: adding ? "not-allowed" : "pointer",
                    transition: "all .22s ease",
                  }}
                >
                  {adding ? "Ajout en cours…" : "Ajouter à mes paris"}
                </button>
              )}
              {disabledMsg && !showButton && (
                <div style={{
                  width: "100%", padding: "12px",
                  background: "rgba(241,235,219,.04)",
                  border: "1px solid rgba(241,235,219,.1)",
                  borderRadius: 12,
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: ".75rem", fontWeight: 400,
                  color: "rgba(241,235,219,.35)",
                  textAlign: "center",
                }}>
                  {disabledMsg}
                </div>
              )}
              {message && (
                <p style={{
                  textAlign: "center",
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: ".8rem", fontWeight: 600,
                  color: message.includes("✅") ? "#4ade80" : "#f87171",
                }}>
                  {message}
                </p>
              )}
            </div>
          )}

          {/* Actions bas */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            {dbId !== null && (
              <Link
                href={`/candidat/${dbId}`}
                onClick={onClose}
                style={{
                  padding: "8px 24px",
                  background: "rgba(241,235,219,.06)",
                  border: "1px solid rgba(241,235,219,.1)",
                  borderRadius: 30,
                  fontFamily: "'Outfit', sans-serif",
                  color: "rgba(241,235,219,.6)",
                  fontSize: ".7rem", fontWeight: 500,
                  letterSpacing: 2, textTransform: "uppercase",
                  cursor: "pointer", transition: "all .2s ease",
                  textDecoration: "none",
                }}
                onMouseOver={e => { const el = e.currentTarget; el.style.borderColor = "rgba(241,235,219,.25)"; el.style.color = "var(--cream)"; }}
                onMouseOut={e  => { const el = e.currentTarget; el.style.borderColor = "rgba(241,235,219,.1)";  el.style.color = "rgba(241,235,219,.6)"; }}
              >
                Voir sa fiche
              </Link>
            )}
            <button
              onClick={onClose}
              style={{
                padding: "8px 24px", background: "transparent",
                border: "1px solid rgba(241,235,219,.14)", borderRadius: 30,
                fontFamily: "'Outfit', sans-serif", color: "rgba(241,235,219,.38)",
                fontSize: ".7rem", fontWeight: 500, letterSpacing: 2, textTransform: "uppercase",
                cursor: "pointer", transition: "all .2s ease",
              }}
              onMouseOver={e => { (e.target as HTMLElement).style.borderColor = "rgba(241,235,219,.32)"; (e.target as HTMLElement).style.color = "rgba(241,235,219,.65)"; }}
              onMouseOut={e  => { (e.target as HTMLElement).style.borderColor = "rgba(241,235,219,.14)"; (e.target as HTMLElement).style.color = "rgba(241,235,219,.38)"; }}
            >
              Fermer
            </button>
          </div>
        </div>
      </div>

      {/* ── MODALE DE CONFIRMATION ── */}
      {showConfirm && (
        <div
          onClick={() => setShowConfirm(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,.92)", backdropFilter: "blur(6px)",
            zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#0f0e1e",
              border: "1px solid rgba(219,135,143,.25)",
              borderRadius: 20, padding: "32px 28px",
              maxWidth: 380, width: "100%",
              textAlign: "center",
            }}
          >
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.2rem", fontWeight: 800, color: "var(--cream)", marginBottom: 12 }}>
              Confirmer le pari
            </h3>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: ".88rem", fontWeight: 300, color: "rgba(241,235,219,.55)", lineHeight: 1.6, marginBottom: 8 }}>
              Ajouter <strong style={{ color: "var(--rose)" }}>{candidat.nom}</strong> à tes paris pour {currentYear} ?
            </p>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: ".72rem", fontWeight: 300, color: "rgba(241,235,219,.28)", marginBottom: 24, fontStyle: "italic" }}>
              Cette action est définitive.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1, padding: "12px",
                  background: "rgba(241,235,219,.06)",
                  border: "1px solid rgba(241,235,219,.12)", borderRadius: 12,
                  fontFamily: "'Outfit', sans-serif", fontSize: ".75rem", fontWeight: 600,
                  letterSpacing: 1, color: "rgba(241,235,219,.5)", cursor: "pointer",
                }}
              >
                Annuler
              </button>
              <button
                onClick={confirmerAjout}
                disabled={adding}
                style={{
                  flex: 1, padding: "12px",
                  background: adding ? "rgba(219,135,143,.4)" : "var(--rose)",
                  color: "#0d0d18", border: "none", borderRadius: 12,
                  fontFamily: "'Outfit', sans-serif", fontSize: ".75rem", fontWeight: 700,
                  letterSpacing: 1, textTransform: "uppercase",
                  cursor: adding ? "not-allowed" : "pointer",
                }}
              >
                {adding ? "Ajout…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(24px) scale(.94); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}