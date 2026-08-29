// app/api/recherche/route.ts
import { NextRequest, NextResponse } from "next/server";
import { CandidatRecherche } from "@/types";

const WIKIDATA_URL = "https://www.wikidata.org/w/api.php";
const FETCH_TIMEOUT_MS = 8000;

// IDENTIFICATION POUR WIKIDATA (obligatoire pour éviter les erreurs 429)
const WIKIDATA_HEADERS = {
  'User-Agent': 'LeJeuDeLaMort/1.0 (contact: victor_creze@hotmail.com) NextJS-App',
  'Accept': 'application/json'
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query || query.length === 0) {
    return NextResponse.json({ candidats: [] });
  }

  try {
    // 1. Recherche des entités Wikidata correspondant à la query
    const searchRes = await fetch(
      `${WIKIDATA_URL}?${new URLSearchParams({
        action: "wbsearchentities",
        language: "fr",
        uselang: "fr",
        format: "json",
        search: query,
        limit: "10",
      })}`,
      {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: WIKIDATA_HEADERS
      }
    );

    if (searchRes.status === 429) {
      return NextResponse.json({ error: "rate_limit" }, { status: 429 });
    }

    if (!searchRes.ok) throw new Error(`Wikidata search HTTP ${searchRes.status}`);
    const searchData = await searchRes.json();

    if (!searchData.search?.length) {
      return NextResponse.json({ candidats: [] });
    }

    const entityIds: string[] = searchData.search.map((item: { id: string }) => item.id);

    // 2. Récupérer les claims de TOUTES les entités en une seule requête
    const entitiesRes = await fetch(
      `${WIKIDATA_URL}?${new URLSearchParams({
        action: "wbgetentities",
        ids: entityIds.join("|"),
        props: "claims|labels|descriptions",
        languages: "fr|en",
        format: "json",
      })}`,
      {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: WIKIDATA_HEADERS
      }
    );

    if (entitiesRes.status === 429) {
      return NextResponse.json({ error: "rate_limit" }, { status: 429 });
    }

    if (!entitiesRes.ok) throw new Error(`Wikidata entities HTTP ${entitiesRes.status}`);
    const entitiesData = await entitiesRes.json();
    const entities = entitiesData.entities ?? {};

    const candidats: CandidatRecherche[] = [];

    for (const item of searchData.search) {
      const entityId: string = item.id;
      const entity = entities[entityId];
      if (!entity) continue;

      const claims = entity.claims ?? {};

      // Garder uniquement les personnes vivantes (P569 = naissance, P570 = décès)
      if (!("P569" in claims) || "P570" in claims) continue;

      // Date de naissance
      // NB: Wikidata encode une précision (9=année, 10=mois, 11=jour). Quand le jour
      // (voire le mois) est inconnu, Wikidata renvoie quand même "00" à leur place
      // (ex: +1964-03-00T00:00:00Z pour "mars 1964"). On retombe sur "01" dans ce cas,
      // sinon "1964-03-00" plante l'insertion en base côté /api/paris (jour hors limites).
      let ddn = "";
      try {
        const value = claims.P569[0].mainsnak.datavalue.value;
        const dateStr: string = value.time;
        const precision: number = value.precision;
        const match = dateStr.match(/\+(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          const year  = match[1];
          const month = precision >= 10 ? match[2] : '01';
          const day   = precision >= 11 ? match[3] : '01';
          ddn = `${year}-${month}-${day}`;
        }
      } catch {
        // date malformée ou absente
      }

      // Photo (P18)
      let photo = "";
      try {
        if (claims.P18?.[0]) {
          photo = (claims.P18[0].mainsnak.datavalue.value as string).replace(/ /g, "_");
        }
      } catch {
        // pas de photo
      }

      const nom: string =
        entity.labels?.fr?.value || entity.labels?.en?.value || item.label || entityId;

      const description: string =
        entity.descriptions?.fr?.value ||
        entity.descriptions?.en?.value ||
        item.description ||
        "";

      candidats.push({ id: entityId, nom, ddn, description, photo, wikidata_id: entityId });

      if (candidats.length === 5) break;
    }

    return NextResponse.json({ candidats });
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");

    console.error("Erreur recherche Wikidata:", err);

    return NextResponse.json(
      { error: isTimeout ? "timeout" : "server_error" },
      { status: isTimeout ? 504 : 500 }
    );
  }
}