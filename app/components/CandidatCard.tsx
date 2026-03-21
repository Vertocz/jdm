// app/components/CandidatCard.tsx
"use client";

import Link from "next/link";
import { formatFr, calculAge, pointsPourAge, formatNomCarte } from "@/utils/fonctions";

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

export default function CandidatCard({ candidat, showDescription = true }: CandidatCardProps) {
  const age    = calculAge(candidat.ddn, candidat.ddd);
  const pts    = pointsPourAge(age);
  const serial = "#" + String(candidat.id).padStart(4, "0");
  const isDead = !!candidat.ddd;
  const { display, fontSize, letterSpacing } = formatNomCarte(candidat.nom);

  const photoUrl = candidat.photo
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(candidat.photo.replace(/ /g, "_"))}`
    : null;

  return (
    <Link href={`/candidat/${candidat.id}`} style={{ textDecoration: "none", display: "block" }}>
      <div className={`panini-card${isDead ? " dead" : ""}`}>
        <div className="pc-bg" />

        {/* Bande latérale */}
        <div className="pc-strip">
          <span className="pc-vname" style={{ fontSize, letterSpacing }}>{display}</span>
        </div>

        {/* Numéro de série */}
        <span className="pc-serial">{serial}</span>

        {/* Zone photo */}
        <div className="pc-photo-zone">
          <div className="pc-placeholder" id={`ph-card-${candidat.id}`}>◆</div>
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={candidat.nom}
              onLoad={e => {
                (e.target as HTMLImageElement).style.display = "block";
                const ph = document.getElementById(`ph-card-${candidat.id}`);
                if (ph) ph.style.display = "none";
              }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              style={{
                display: "none",
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                objectFit: "cover", objectPosition: "center top",
              }}
            />
          )}
        </div>

        {/* Bulle points */}
        <div className="pc-pts">
          <span className="pn">{pts}</span>
          <span className="pl">{pts > 1 ? "pts" : "pt"}</span>
        </div>

        {/* Infos bas */}
        <div className="pc-info">
          <div className="pc-dates">
            <div className="pc-date-item">
              <span className="pc-date-lbl">Naissance</span>
              <span className="pc-date-val">{formatFr(candidat.ddn)}</span>
            </div>
            {isDead && (
              <>
                <span className="pc-sep">→</span>
                <div className="pc-date-item">
                  <span className="pc-date-lbl">Décès</span>
                  <span className="pc-date-val">{formatFr(candidat.ddd)}</span>
                </div>
              </>
            )}
          </div>
          {age !== null && <div className="pc-age">{age} ans</div>}
          {showDescription && candidat.description && (
            <p style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: ".52rem", fontWeight: 300,
              color: "rgba(241,235,219,.35)",
              fontStyle: "italic", lineHeight: 1.5,
              marginTop: 4,
            }}>
              {candidat.description.charAt(0).toUpperCase() + candidat.description.slice(1)}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}