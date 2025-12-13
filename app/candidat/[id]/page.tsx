// app/candidat/[id]/page.tsx
"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatFr, calculAge, pointsPourAge } from "@/utils/fonctions";
import Image from "next/image";
import Link from "next/link";

export default function PageCandidat({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const candidatId = Number(id);

  const [candidat, setCandidat] = useState<any>(null);
  const [votes, setVotes] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // 1) Récupérer le candidat
      const { data: cand } = await supabase
        .from("candidats")
        .select("*")
        .eq("id", candidatId)
        .maybeSingle();

      setCandidat(cand);

      if (!cand) {
        setLoading(false);
        return;
      }

      // 2) Récupérer tous les paris sur ce candidat
      const { data: paris } = await supabase
        .from("paris")
        .select("id, saison, joueur")
        .eq("candidat_id", candidatId);

      if (!paris || paris.length === 0) {
        setVotes([]);
        setLoading(false);
        return;
      }

      // 3) Récupérer les profils correspondants
      const joueurs = [...new Set(paris.map((p) => p.joueur))];
      const { data: profils } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", joueurs);

      // 4) Reconstituer l'information : vote + pseudo
      const votesComplet = paris.map((p) => ({
        ...p,
        display_name:
          profils?.find((pr) => pr.user_id === p.joueur)?.display_name ??
          "Joueur inconnu",
      }));

      setVotes(votesComplet);

      // 5) Années disponibles
      const uniqueYears = [...new Set(votesComplet.map((v) => v.saison))].sort(
        (a, b) => b - a
      );
      setYears(uniqueYears);
      setSelectedYear(uniqueYears[0] ?? null);

      setLoading(false);
    };

    load();
  }, [candidatId]);

  if (loading) return <p>Chargement...</p>;

  if (!candidat) return <p>Candidat introuvable.</p>;

  const photoUrl = candidat.photo
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${candidat.photo}`
    : "/candidat.png";

  const isDead = !!candidat.ddd;
  const age = calculAge(candidat.ddn, candidat.ddd);
  const points = pointsPourAge(age);

  // Stats générales
  const totalVotes = votes.length;
  const firstVoteYear = totalVotes > 0 ? Math.min(...votes.map((v) => v.saison)) : null;

  // Gagnants (ceux qui ont voté l'année du décès)
  const gagnants = isDead
    ? votes.filter((v) => v.saison === new Date(candidat.ddd).getFullYear())
    : [];

  // Votes de l'année sélectionnée
  const votesYear = selectedYear ? votes.filter((v) => v.saison === selectedYear) : [];

  return (
    <div>
      {/* En-tête avec photo */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
          marginBottom: "40px",
        }}
      >
        <div
          style={{
            width: "250px",
            height: "300px",
            borderRadius: "15px",
            overflow: "hidden",
            border: `3px solid ${isDead ? "#888" : "var(--c2)"}`,
            boxShadow: "0 8px 20px rgba(0, 0, 0, 0.4)",
          }}
          className={isDead ? "grayscale" : ""}
        >
          <Image
            src={photoUrl}
            alt={candidat.nom}
            width={250}
            height={300}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "/candidat.png";
            }}
          />
        </div>

        <h1 style={{ margin: "0" }}>{candidat.nom}</h1>
      </div>

      {/* Informations principales */}
      <div className="stats-container" style={{ marginBottom: "30px" }}>
        <div className="stat-box">
          <div className="stat-label">Naissance</div>
          <div className="stat-value" style={{ fontSize: "1.3rem" }}>
            {formatFr(candidat.ddn)}
          </div>
        </div>

        {isDead && (
          <div className="stat-box">
            <div className="stat-label">Décès</div>
            <div className="stat-value" style={{ fontSize: "1.3rem" }}>
              {formatFr(candidat.ddd)}
            </div>
          </div>
        )}

        <div className="stat-box">
          <div className="stat-value">{age ?? "—"}</div>
          <div className="stat-label">ans</div>
        </div>

        <div className="stat-box stat-poker">
          <div className="stat-value">{points}</div>
          <div className="stat-label">Point{points > 1 ? "s" : ""}</div>
        </div>
      </div>

      {/* Description */}
      {candidat.description && (
        <p
          style={{
            color: "var(--fond)",
            fontWeight: "bolder",
            maxWidth: "800px",
            margin: "0 auto 40px",
            fontSize: "1.1rem",
            lineHeight: "1.6",
            fontStyle: "italic",
            padding: "20px",
            background: "var(--c2)",
            borderRadius: "10px",
            border: "3px solid var(--text)",
          }}
        >
          {candidat.description.charAt(0).toUpperCase() + candidat.description.slice(1)}
        </p>
      )}

      {/* Statistiques de votes */}
      <h2>Statistiques</h2>
      <div className="stats-container" style={{ marginBottom: "40px" }}>
        <div className="stat-box">
          <div className="stat-value">{totalVotes}</div>
          <div className="stat-label">Pari{totalVotes > 1 ? "s" : ""} au total</div>
        </div>

        <div className="stat-box">
          <div className="stat-value">{firstVoteYear ?? "—"}</div>
          <div className="stat-label">Premier pari</div>
        </div>

        {isDead && gagnants.length > 0 && (
          <div className="stat-box stat-poker">
            <div className="stat-value">{gagnants.length}</div>
            <div className="stat-label">
              Gagnant{gagnants.length > 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>

      {/* Liste des parieurs par année */}
      {years.length > 0 && (
        <>
          <h2>Parieurs par année</h2>

          <div className="year-buttons">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`year-button ${y === selectedYear ? "active" : ""}`}
              >
                {y}
                {isDead && y === new Date(candidat.ddd).getFullYear() && " 🏆"}
              </button>
            ))}
          </div>

          <div style={{ maxWidth: "600px", margin: "20px auto" }}>
            {votesYear.length === 0 && (
              <p>Aucun parieur pour {selectedYear}.</p>
            )}
            {votesYear.map((v) => {
              const isWinner =
                isDead && v.saison === new Date(candidat.ddd).getFullYear();

              return (
                <div
                  key={v.id}
                  style={{
                    background: isWinner
                      ? "linear-gradient(90deg, rgba(255, 215, 0, 0.2), rgba(78, 57, 41, 0.2))"
                      : "var(--c1)",
                    padding: "15px 20px",
                    margin: "10px 0",
                    borderRadius: "8px",
                    border: isWinner ? "2px solid #ffd700" : "2px solid var(--c1)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Link
                    href={`/joueur/${v.joueur}`}
                    className="no-underline"
                    style={{
                      color: "var(--c2)",
                      fontWeight: "700",
                      fontSize: "1.1rem",
                    }}
                  >
                    {v.display_name}
                  </Link>
                  {isWinner && (
                    <span style={{ fontSize: "1.5rem" }}>🏆</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}