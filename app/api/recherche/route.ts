// app/api/recherche/route.ts
import { NextRequest, NextResponse } from "next/server";
import { CandidatRecherche } from "@/types";

const WIKIDATA_URL = "https://www.wikidata.org/w/api.php";
const FETCH_TIMEOUT_MS = 8000;

// IDENTIFICATION POUR WIKIDATA (Crucial pour éviter l'erreur 429)
const WIKIDATA_HEADERS = {
  // Remplace 'ton-email@example.com' par ton adresse réelle
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

    // Check spécifique pour le rate-limit
    if (searchRes.status === 429) {
      throw new Error("Wikidata HTTP 429: Too Many Requests (Rate Limited)");
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
      throw new Error("Wikidata HTTP 429: Too Many Requests (Rate Limited)");
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
      let ddn = "";
      try {
        const dateStr: string = claims.P569[0].mainsnak.datavalue.value.time;
        const match = dateStr.match(/\+(\d{4})-(\d{2})-(\d{2})/);
        if (match) ddn = `${match[1]}-${match[2]}-${match[3]}`;
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
    
    const isRateLimit = err instanceof Error && err.message.includes("429");

    console.error("Erreur recherche Wikidata:", err);
    
    return NextResponse.json(
      { 
        error: isRateLimit 
          ? "Service temporairement indisponible (Wikidata Rate Limit)" 
          : (isTimeout ? "Délai dépassé" : "Erreur lors de la recherche") 
      },
      { status: isRateLimit ? 429 : (isTimeout ? 504 : 500) }
    );
  }
}
