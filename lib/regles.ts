// lib/regles.ts
//
// Source unique des règles du jeu : âge, barème, pari gagnant.
// Le même barème existe côté base (fonction SQL public.points_pour_age et
// public.classement) : toute modification doit être faite aux deux endroits.
//
// Les dates sont manipulées en chaînes "YYYY-MM-DD" et jamais via new Date(),
// qui les interprète en UTC et décale d'un jour selon le fuseau du navigateur.

interface Ymd { y: number; m: number; d: number }

function ymd(iso: string): Ymd {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y, m: m || 1, d: d || 1 };
}

/** Date du jour à Paris, en "YYYY-MM-DD". */
export function aujourdhuiParis(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now);
}

/** Année d'une date "YYYY-MM-DD". */
export function annee(iso: string): number {
  return Number(iso.slice(0, 4));
}

/** Âge en années révolues, au décès si ddd est fourni, sinon aujourd'hui. */
export function calculAge(ddn: string | null | undefined, ddd?: string | null): number | null {
  if (!ddn) return null;
  const b = ymd(ddn);
  const r = ymd(ddd ?? aujourdhuiParis());
  let age = r.y - b.y;
  if (r.m < b.m || (r.m === b.m && r.d < b.d)) age--;
  return age;
}

/** Barème de points selon l'âge au décès. */
export function pointsPourAge(age: number | null): number {
  if (age === null) return 0;
  if (age < 55) return 10;
  if (age < 65) return 9;
  if (age < 75) return 8;
  if (age < 80) return 7;
  if (age < 85) return 5;
  if (age < 90) return 3;
  return 1;
}

/**
 * Un pari rapporte des points si le candidat meurt pendant la saison du pari
 * et si le pari a été posé avant le jour du décès (heure de Paris).
 * Les paris sans date de création (antérieurs à novembre 2026) restent valables.
 */
export function pariGagnant(
  pari: { saison: number; created_at?: string | null },
  candidat: { ddd: string | null } | null | undefined,
): boolean {
  const ddd = candidat?.ddd;
  if (!ddd || annee(ddd) !== pari.saison) return false;
  if (!pari.created_at) return true;
  return aujourdhuiParis(new Date(pari.created_at)) < ddd;
}

/** Le candidat est encore « en jeu » pour cette saison (vivant, ou mort après). */
export function pariEnCours(pari: { saison: number }, candidat: { ddd: string | null } | null | undefined): boolean {
  const ddd = candidat?.ddd;
  return !ddd || annee(ddd) > pari.saison;
}
