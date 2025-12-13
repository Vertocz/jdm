// app/components/CandidatCardModal.tsx
"use client";

import Image from "next/image";
import { calculAge, pointsPourAge } from "@/utils/fonctions";
import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";

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
}

export default function CandidatCardModal({
  candidat,
  onClose,
  user,
}: CandidatCardModalProps) {
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");

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

  const ajouterPari = async () => {
    if (!user) {
      setMessage("Tu dois être connecté pour ajouter un pari !");
      return;
    }

    setAdding(true);
    setMessage("");

    try {
      // 1. Vérifier si le candidat existe déjà dans Supabase
      const { data: existingCandidat, error: searchError } = await supabase
        .from("candidats")
        .select("id")
        .eq("wikidata_id", candidat.wikidata_id)
        .maybeSingle();

      let candidatId: number;

      if (existingCandidat) {
        // Le candidat existe déjà
        candidatId = existingCandidat.id;
      } else {
        // Créer le nouveau candidat
        const { data: newCandidat, error: insertError } = await supabase
          .from("candidats")
          .insert({
            nom: candidat.nom,
            ddn: candidat.ddn,
            ddd: null,
            description: candidat.description || "",
            photo: candidat.photo || "",
            wikidata_id: candidat.wikidata_id,
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        candidatId = newCandidat.id;
      }

      // 2. Vérifier si l'utilisateur a déjà parié sur ce candidat cette année
      const currentYear = new Date().getFullYear();
      const { data: existingPari } = await supabase
        .from("paris")
        .select("id")
        .eq("joueur", user.id)
        .eq("candidat_id", candidatId)
        .eq("saison", currentYear)
        .maybeSingle();

      if (existingPari) {
        setMessage("Tu as déjà parié sur ce candidat cette année !");
        setAdding(false);
        return;
      }

      // 3. Vérifier que l'utilisateur n'a pas déjà 10 paris cette année
      const { data: parisUser, error: countError } = await supabase
        .from("paris")
        .select("id")
        .eq("joueur", user.id)
        .eq("saison", currentYear);

      if (parisUser && parisUser.length >= 10) {
        setMessage("Tu as déjà 10 paris cette année !");
        setAdding(false);
        return;
      }

      // 4. Créer le pari
      const { error: pariError } = await supabase.from("paris").insert({
        joueur: user.id,
        candidat_id: candidatId,
        saison: currentYear,
        mort: false,
      });

      if (pariError) {
        throw pariError;
      }

      setMessage("✅ Pari ajouté avec succès !");
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Erreur lors de l'ajout du pari:", error);
      setMessage("❌ Erreur lors de l'ajout du pari");
    }

    setAdding(false);
  };

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
        {/* Bouton fermer */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "-20px",
            right: "52px",
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
          }}
        >
          ×
        </button>

        {/* Carte Panini */}
        <div className="panini-card panini-card-modal" style={{ margin: 0 }}>
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

            {/* Bouton ajouter pari */}
            {user && (
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
            )}

            {message && (
              <p
                style={{
                  marginTop: "10px",
                  fontSize: "0.9rem",
                  fontWeight: "600",
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