// app/components/CandidatCardModal.tsx
"use client";

import Image from "next/image";
import { User } from "@supabase/supabase-js";
import { calculAge, pointsPourAge, capitalizeFirst } from "@/utils/fonctions";
import { useState } from "react";
import { useAddCandidat } from "@/app/hooks/useAddCandidat";
import { CandidatRecherche } from "@/types";

interface CandidatCardModalProps {
  candidat: CandidatRecherche;
  onClose: () => void;
  user?: User | null;
  // Props optionnelles pour la salle d'attente
  saison?: number;
  parisEnCours?: number;
  existingPariIds?: string[];
  onCandidatAdded?: () => void;
}

export default function CandidatCardModal({
  candidat,
  onClose,
  user,
  saison,
  parisEnCours,
  existingPariIds,
  onCandidatAdded,
}: CandidatCardModalProps) {
  const [message, setMessage] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const { addCandidat, loading: adding } = useAddCandidat(user?.id);

  const age = calculAge(candidat.ddn, null);
  const points = pointsPourAge(age);

  const photoUrl = candidat.photo
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${candidat.photo}`
    : "/candidat.png";

  const currentYear = saison ?? new Date().getFullYear();
  const canAdd = !!user && (parisEnCours !== undefined ? parisEnCours < 10 : true);
  const alreadyAdded = existingPariIds?.includes(candidat.wikidata_id);
  const showButton = user && !alreadyAdded && canAdd;
  const disabledMessage = alreadyAdded
    ? "Déjà dans ta salle d'attente"
    : !canAdd
    ? "Tu as déjà 10 candidats"
    : null;

  const ajouterPari = () => {
    if (!user) { setMessage("Tu dois être connecté pour ajouter un pari !"); return; }
    if (!canAdd) { setMessage("Tu as déjà 10 paris cette année !"); return; }
    if (alreadyAdded) { setMessage("Tu as déjà parié sur ce candidat cette année !"); return; }
    setShowConfirmModal(true);
  };

  const confirmerAjout = async () => {
    setShowConfirmModal(false);
    setMessage("");

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
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Fiche de ${candidat.nom}`}
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        style={{ position: "relative", maxWidth: "350px", width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bouton fermer */}
        <button
          onClick={onClose}
          aria-label="Fermer"
          style={{
            position: "absolute",
            top: "-15px", right: "-15px",
            width: "40px", height: "40px",
            borderRadius: "50%",
            background: "var(--c2)",
            color: "var(--fond)",
            border: "3px solid var(--fond)",
            fontSize: "1.5rem",
            cursor: "pointer",
            zIndex: 1001,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "700",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
          }}
        >
          ×
        </button>

        {/* Carte Panini */}
        <div
          className="panini-card panini-card-modal"
          style={{ margin: 0, transform: "none !important", transition: "none !important" }}
        >
          <div className="panini-header">
            <h3 className="panini-name">{candidat.nom}</h3>
          </div>

          <div className="panini-photo-container" style={{ height: "300px" }}>
            <Image
              src={photoUrl}
              alt={candidat.nom}
              width={300}
              height={300}
              className="panini-photo"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/candidat.png";
              }}
            />
          </div>

          <div className="panini-info">
            <div className="panini-dates">
              <span className="panini-value">
                Né⸱e le{" "}
                {candidat.ddn
                  ? new Date(candidat.ddn).toLocaleDateString("fr-FR")
                  : "—"}
              </span>
            </div>

            <div className="panini-stats">
              <div className="panini-stat">
                <span className="panini-stat-label">Âge</span>
                <span className="panini-stat-value">
                  {age ?? "—"} an{age && age > 1 ? "s" : ""}
                </span>
              </div>
              <div className="panini-stat panini-stat-points">
                <span className="panini-stat-label">Points</span>
                <span className="panini-stat-value">
                  {points} pt{points > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {candidat.description && (
              <p className="panini-description">{capitalizeFirst(candidat.description)}</p>
            )}

            {user && (
              <>
                {showButton ? (
                  <button
                    onClick={ajouterPari}
                    disabled={adding}
                    style={{
                      marginTop: "15px",
                      width: "100%",
                      padding: "12px",
                      background: adding ? "#888" : "var(--c2)",
                      color: "var(--fond)",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "1rem",
                      fontWeight: "700",
                      cursor: adding ? "not-allowed" : "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {adding ? "Ajout en cours..." : "Ajouter à mes paris"}
                  </button>
                ) : disabledMessage && (
                  <div
                    style={{
                      marginTop: "15px",
                      width: "100%",
                      padding: "12px",
                      background: "rgba(78, 57, 41, 0.5)",
                      color: "rgba(241, 235, 219, 0.7)",
                      border: "2px solid var(--c1)",
                      borderRadius: "8px",
                      fontSize: "0.95rem",
                      fontWeight: "600",
                      textAlign: "center",
                    }}
                  >
                    {disabledMessage}
                  </div>
                )}
              </>
            )}

            {message && (
              <p
                style={{
                  marginTop: "10px",
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  textAlign: "center",
                  color: message.includes("✅") ? "#4ade80" : "#f87171",
                }}
              >
                {message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modal de confirmation */}
      {showConfirmModal && (
        <div
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "20px",
          }}
          role="dialog"
          aria-modal="true"
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            style={{
              background: "linear-gradient(145deg, var(--card-bg) 0%, #1f3240 100%)",
              border: "3px solid var(--c2)",
              borderRadius: "20px",
              padding: "30px",
              maxWidth: "400px",
              width: "100%",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: "var(--c2)", marginBottom: "20px", fontSize: "1.5rem" }}>
              Confirmer le pari
            </h3>

            <p style={{ marginBottom: "10px", fontSize: "1.1rem", lineHeight: "1.6" }}>
              Êtes-vous sûr de vouloir ajouter{" "}
              <strong style={{ color: "var(--c2)" }}>{candidat.nom}</strong>{" "}
              à vos paris pour {currentYear} ?
            </p>

            <p style={{ marginBottom: "25px", fontSize: "0.95rem", color: "rgba(241, 235, 219, 0.7)", fontStyle: "italic" }}>
              Cette action est définitive et ne peut pas être annulée.
            </p>

            <div style={{ display: "flex", gap: "15px", justifyContent: "center" }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: "12px 24px",
                  background: "var(--c1)",
                  color: "var(--text)",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "1rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                Annuler
              </button>

              <button
                onClick={confirmerAjout}
                disabled={adding}
                style={{
                  padding: "12px 24px",
                  background: adding ? "#888" : "var(--c2)",
                  color: "var(--fond)",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "1rem",
                  fontWeight: "700",
                  cursor: adding ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {adding ? "Ajout..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
