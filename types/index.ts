// types/index.ts
// ─── Types partagés dans toute l'application ────────────────────────────────

export interface Candidat {
  id: number;
  nom: string;
  ddn: string | null;
  ddd: string | null;
  description?: string;
  photo?: string;
  wikidata_id: string;
}

/** Candidat tel que renvoyé par l'API Wikidata (pas encore en base) */
export interface CandidatRecherche {
  id: string;
  nom: string;
  ddn: string;
  description: string;
  photo: string;
  wikidata_id: string;
}

export interface Pari {
  id: string;
  mort: boolean;
  saison: number;
  candidat_id: number;
  candidats: Candidat;
}

export interface Profile {
  user_id: string;
  display_name: string;
  alert_mes_candidats?: boolean;
  alert_autres_candidats?: boolean;
}
