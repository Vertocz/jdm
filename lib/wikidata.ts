// lib/wikidata.ts
//
// Accès à Wikidata partagé par les routes API et les crons :
// en-têtes (User-Agent exigé par Wikimedia), timeout, lecture des dates.

export const WIKIDATA_URL = 'https://www.wikidata.org/w/api.php';

// Wikimedia demande un User-Agent qui identifie l'application et un moyen de contact.
export const WIKIDATA_HEADERS: Record<string, string> = {
  'User-Agent': 'LeJeuDeLaMort/1.0 (https://lejeudelamort.fr)',
  'Accept': 'application/json',
};

export class WikidataRateLimitError extends Error {
  constructor() { super('Wikidata HTTP 429: Too Many Requests'); this.name = 'WikidataRateLimitError'; }
}

export async function wikidataFetch(params: Record<string, string>, timeoutMs = 8_000): Promise<Response> {
  const res = await fetch(`${WIKIDATA_URL}?${new URLSearchParams({ format: 'json', ...params })}`, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: WIKIDATA_HEADERS,
  });
  if (res.status === 429) throw new WikidataRateLimitError();
  return res;
}

// ─── Dates ───────────────────────────────────────────────────────────────────

interface WikidataTime { time?: string; precision?: number }

/**
 * Convertit une date Wikidata en "YYYY-MM-DD".
 * Wikidata encode la précision (9 = année, 10 = mois, 11 = jour) et met "00"
 * à la place du jour ou du mois inconnu (ex: +1964-03-00T00:00:00Z) : Postgres
 * refuse ces dates, on retombe donc sur "01".
 */
export function parseWikidataDate(value: WikidataTime | undefined | null): string | null {
  if (!value?.time) return null;
  const m = value.time.match(/^\+(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const precision = value.precision ?? 11;
  if (precision < 9) return null; // décennie ou moins précis : inexploitable
  const month = precision >= 10 && m[2] !== '00' ? m[2] : '01';
  const day   = precision >= 11 && m[3] !== '00' ? m[3] : '01';
  return `${m[1]}-${month}-${day}`;
}

// ─── Déclarations (claims) ───────────────────────────────────────────────────

interface Claim { rank?: string; mainsnak?: { datavalue?: { value?: unknown } } }

/**
 * Valeur de la meilleure déclaration d'une propriété : rang "preferred" d'abord,
 * puis "normal" ; les déclarations "deprecated" (erronées) sont ignorées.
 */
export function bestClaimValue<T = unknown>(claims: Record<string, Claim[]> | undefined, prop: string): T | undefined {
  const list = (claims?.[prop] ?? []).filter(c => c.rank !== 'deprecated');
  const best = list.find(c => c.rank === 'preferred') ?? list[0];
  return best?.mainsnak?.datavalue?.value as T | undefined;
}

export function hasClaim(claims: Record<string, Claim[]> | undefined, prop: string): boolean {
  return (claims?.[prop] ?? []).some(c => c.rank !== 'deprecated');
}

export interface WikidataPersonne {
  wikidata_id: string;
  nom: string;
  ddn: string | null;
  ddd: string | null;
  decede: boolean;
  photo: string | null;
  description: string;
  estPersonne: boolean; // a une date de naissance (P569)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function entityToPersonne(id: string, entity: any, fallbackLabel?: string, fallbackDescription?: string): WikidataPersonne {
  const claims = entity?.claims ?? {};
  const photoRaw = bestClaimValue<string>(claims, 'P18');
  return {
    wikidata_id: id,
    nom: entity?.labels?.fr?.value || entity?.labels?.en?.value || fallbackLabel || id,
    ddn: parseWikidataDate(bestClaimValue<WikidataTime>(claims, 'P569')),
    ddd: parseWikidataDate(bestClaimValue<WikidataTime>(claims, 'P570')),
    // Une déclaration de décès présente mais sans date lisible compte quand même.
    decede: hasClaim(claims, 'P570'),
    photo: photoRaw ? photoRaw.replace(/ /g, '_') : null,
    description: entity?.descriptions?.fr?.value || entity?.descriptions?.en?.value || fallbackDescription || '',
    estPersonne: hasClaim(claims, 'P569'),
  };
}

/** Récupère jusqu'à 50 entités en un appel. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getEntities(ids: string[], props = 'claims|labels|descriptions', timeoutMs = 8_000): Promise<Record<string, any>> {
  if (ids.length === 0) return {};
  const res = await wikidataFetch({ action: 'wbgetentities', ids: ids.join('|'), props, languages: 'fr|en' }, timeoutMs);
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
  const data = await res.json();
  return data.entities ?? {};
}
