// app/components/CandidatCardModal.tsx
"use client";

import Image from "next/image";
import { calculAge, pointsPourAge } from "@/utils/fonctions";
import { useState } from "react";
import { useAddCandidat } from "@/app/hooks/useAddCandidat";

interface CandidatCardModalProps {
  candidat: {
    id: string;
    nom: string;
    ddn: string;
    description?: string;
    photo?: string;
    wikidata_id: string;
  };
  onClose: () => void;
  user?: any;
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
  const { addCandidat, loading: adding } = useAddCandidat(user?.id);

  const age = calculAge(candidat.ddn, null);
  const points = pointsPourAge(age);

  const photoUrl = candidat.photo
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${candidat.photo}`
    : "/candidat.png";

  // Capitaliser la première lettre de la description
  const capitalizeFirst = (text: string) => {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // Vérifier si on peut ajouter le candidat
  const currentYear = saison || new Date().getFullYear();
  const canAdd = user && (parisEnCours !== undefined ? parisEnCours < 10 : true);
  const alreadyAdded = existingPariIds?.includes(candidat.wikidata_id);

  const ajouterPari = async () => {
    if (!user) {
      setMessage("Tu dois être connecté pour ajouter un pari !");
      return;
    }

    if (!canAdd) {
      setMessage("Tu as déjà 10 paris cette année !");
      return;
    }

    if (alreadyAdded) {
      setMessage("Tu as déjà parié sur ce candidat cette année !");
      return;
    }

    setMessage("");

    const result = await addCandidat(candidat, currentYear);

    if (result.success) {
      setMessage("✅ Pari ajouté avec succès !");
      if (onCandidatAdded) {
        onCandidatAdded();
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setMessage(`❌ ${result.error}`);
    }
  };

  // Déterminer si on doit afficher le bouton
  const showButton = user && !alreadyAdded && canAdd;
  const disabledMessage = alreadyAdded 
    ? "Déjà dans ta salle d'attente" 
    : !canAdd 
    ? "Tu as déjà 10 candidats" 
    : null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: "350px",
          width: "100%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bouton fermer - position responsive */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "-15px",
            right: "-15px",
            width: "40px",
            height: "40px",
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
          style={{ 
            margin: 0,
            transform: 'none !important',
            transition: 'none !important'
          }}
        >
          <div className="panini-header">
            <h3 className="panini-name">{candidat.nom}</h3>
          </div>

          <div
            className="panini-photo-container"
            style={{ height: "300px" }}
          >
            <Image
              src={photoUrl}
              alt={candidat.nom}
              width={300}
              height={300}
              className="panini-photo"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "/candidat.png";
              }}
            />
          </div>

          <div className="panini-info">
            <div className="panini-dates">
              <span className="panini-value">
                Né⸱e le {candidat.ddn
                  ? new Date(candidat.ddn).toLocaleDateString("fr-FR")
                  : "—"}
              </span>
            </div>

            <div className="panini-stats">
              <div className="panini-stat">
                <span className="panini-stat-label">Âge</span>
                <span className="panini-stat-value">{age ?? "—"} an{age && age > 1 ? "s" : ""}</span>
              </div>
              <div className="panini-stat panini-stat-points">
                <span className="panini-stat-label">Points</span>
                <span className="panini-stat-value">{points} pt{points > 1 ? "s" : ""}</span>
              </div>
            </div>

            {candidat.description && (
              <p className="panini-description">{capitalizeFirst(candidat.description)}</p>
            )}

            {/* Bouton ajouter pari ou message d'info */}
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
    </div>
  );
}