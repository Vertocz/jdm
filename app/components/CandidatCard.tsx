// app/components/CandidatCard.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { formatFr, calculAge, pointsPourAge } from "@/utils/fonctions";

interface CandidatCardProps {
  candidat: {
    id: number;
    nom: string;
    ddn: string | null;
    ddd: string | null;
    description?: string;
    photo?: string;
  };
  showDescription?: boolean;
  className?: string;
}

export default function CandidatCard({
  candidat,
  showDescription = true,
  className = "",
}: CandidatCardProps) {
  const age = calculAge(candidat.ddn, candidat.ddd);
  const points = pointsPourAge(age);
  
  const photoUrl = candidat.photo
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${candidat.photo}`
    : "/candidat.png";

  const isDead = !!candidat.ddd;

  return (
    <div
      className={`panini-card ${isDead ? "panini-dead" : ""} ${className}`}
    >
      <Link
        href={`/candidat/${candidat.id}`}
        className="no-underline"
      >
        {/* En-tête de la carte */}
        <div className="panini-header">
          <h3 className="panini-name">{candidat.nom}</h3>
        </div>

        {/* Photo */}
        <div className="panini-photo-container">
          <Image
            src={photoUrl}
            alt={candidat.nom}
            width={200}
            height={240}
            className="panini-photo"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "/candidat.png";
            }}
          />
        </div>

        {/* Informations */}
        <div className="panini-info">
          {isDead ? (
            <div className="panini-dates">
              <span className="panini-value">{formatFr(candidat.ddn)} — {formatFr(candidat.ddd)}</span>
            </div>
          ) : (
            <div className="panini-dates">
              <span className="panini-label">Né⸱e le</span>
              <span className="panini-value">{formatFr(candidat.ddn)}</span>
            </div>
          )}

          <div className="panini-stats">
            <div className="panini-stat">
              <span className="panini-stat-label">Âge</span>
              <span className="panini-stat-value">{age ?? "—"} ans</span>
            </div>
            <div className="panini-stat panini-stat-points">
              <span className="panini-stat-label">Point{points > 1 ? "s" : ""}</span>
              <span className="panini-stat-value">{points}</span>
            </div>
          </div>

          {showDescription && candidat.description && (
            <p className="panini-description">
              {candidat.description.charAt(0).toUpperCase() + candidat.description.slice(1)}
            </p>
          )}
        </div>
      </Link>
    </div>
  );
}