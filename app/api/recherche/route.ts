// app/api/recherche/route.ts
import { NextRequest, NextResponse } from 'next/server';

const WIKIDATA_URL = 'https://www.wikidata.org/w/api.php';
const FETCH_TIMEOUT_MS = 8000;

interface CandidatWikidata {
  id: string;
  nom: string;
  ddn: string;
  description: string;
  photo: string;
  wikidata_id: string;
}

function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();

  if (!query || query.length === 0) {
    return NextResponse.json({ candidats: [] });
  }

  try {
    // 1. Recherche des entités Wikidata correspondant à la query
    const searchRes = await fetchWithTimeout(
      `${WIKIDATA_URL}?${new URLSearchParams({
        action: 'wbsearchentities',
        language: 'fr',
        uselang: 'fr',
        format: 'json',
        search: query,
        limit: '10',
      })}`,
      FETCH_TIMEOUT_MS
    );

    if (!searchRes.ok) throw new Error(`Wikidata search HTTP ${searchRes.status}`);
    const searchData = await searchRes.json();

    if (!searchData.search?.length) {
      return NextResponse.json({ candidats: [] });
    }

    const entityIds: string[] = searchData.search.map((item: { id: string }) => item.id);

    // 2. Récupérer les claims de TOUTES les entités en une seule requête (wbgetentities)
    //    au lieu de N requêtes wbgetclaims parallèles
    const entitiesRes = await fetchWithTimeout(
      `${WIKIDATA_URL}?${new URLSearchParams({
        action: 'wbgetentities',
        ids: entityIds.join('|'),
        props: 'claims|labels|descriptions',
        languages: 'fr|en',
        format: 'json',
      })}`,
      FETCH_TIMEOUT_MS
    );

    if (!entitiesRes.ok) throw new Error(`Wikidata entities HTTP ${entitiesRes.status}`);
    const entitiesData = await entitiesRes.json();
    const entities = entitiesData.entities ?? {};

    const candidats: CandidatWikidata[] = [];

    for (const item of searchData.search) {
      const entityId: string = item.id;
      const entity = entities[entityId];
      if (!entity) continue;

      const claims = entity.claims ?? {};

      // Garder uniquement les personnes vivantes (P569 = naissance, P570 = décès)
      const hasDateNaissance = 'P569' in claims;
      const hasDateDeces = 'P570' in claims;
      if (!hasDateNaissance || hasDateDeces) continue;

      // Date de naissance
      let ddn = '';
      try {
        const dateStr: string = claims.P569[0].mainsnak.datavalue.value.time;
        const match = dateStr.match(/\+(\d{4})-(\d{2})-(\d{2})/);
        if (match) ddn = `${match[1]}-${match[2]}-${match[3]}`;
      } catch {
        // date malformée ou absente — on garde ddn vide
      }

      // Photo (P18)
      let photo = '';
      try {
        if (claims.P18?.[0]) {
          photo = (claims.P18[0].mainsnak.datavalue.value as string).replace(/ /g, '_');
        }
      } catch {
        // pas de photo
      }

      // Label en français, fallback anglais
      const nom: string =
        entity.labels?.fr?.value ||
        entity.labels?.en?.value ||
        item.label ||
        entityId;

      // Description en français, fallback anglais puis celle de la recherche
      const description: string =
        entity.descriptions?.fr?.value ||
        entity.descriptions?.en?.value ||
        item.description ||
        '';

      candidats.push({ id: entityId, nom, ddn, description, photo, wikidata_id: entityId });

      if (candidats.length === 5) break; // Limiter à 5 résultats
    }

    return NextResponse.json({ candidats });

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    console.error('Erreur recherche Wikidata:', err);
    return NextResponse.json(
      { error: isTimeout ? 'Délai dépassé' : 'Erreur lors de la recherche' },
      { status: isTimeout ? 504 : 500 }
    );
  }
}