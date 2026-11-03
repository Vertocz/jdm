// app/api/recherche/route.ts
//
// GET /api/recherche?q=... — recherche de personnes vivantes sur Wikidata.
// Route publique (la recherche est utilisable sans compte) : les réponses sont
// mises en cache par le CDN et le nombre de requêtes par IP est limité.

import { NextRequest, NextResponse } from "next/server";
import { CandidatRecherche } from "@/types";
import { entityToPersonne, getEntities, wikidataFetch, WikidataRateLimitError } from "@/lib/wikidata";

// Limite simple par IP, en mémoire de l'instance (protection d'appoint :
// chaque instance serverless a son propre compteur).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { count: number; start: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.start > WINDOW_MS) {
    hits.set(ip, { count: 1, start: now });
    if (hits.size > 5_000) hits.clear();
    return false;
  }
  h.count++;
  return h.count > MAX_PER_WINDOW;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100);

  if (!query) {
    return NextResponse.json({ candidats: [] });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "inconnue";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "rate_limit" }, { status: 429 });
  }

  try {
    // 1. Recherche des entités Wikidata correspondant à la query
    const searchRes = await wikidataFetch({
      action: "wbsearchentities",
      language: "fr",
      uselang: "fr",
      search: query,
      limit: "10",
    });
    if (!searchRes.ok) throw new Error(`Wikidata search HTTP ${searchRes.status}`);
    const searchData = await searchRes.json();

    if (!searchData.search?.length) {
      return NextResponse.json({ candidats: [] });
    }

    // 2. Récupérer les claims de TOUTES les entités en une seule requête
    const entities = await getEntities(searchData.search.map((item: { id: string }) => item.id));

    const candidats: CandidatRecherche[] = [];
    for (const item of searchData.search) {
      const entity = entities[item.id];
      if (!entity) continue;

      const p = entityToPersonne(item.id, entity, item.label, item.description);

      // Garder uniquement les personnes vivantes (P569 = naissance, P570 = décès)
      if (!p.estPersonne || p.decede) continue;

      candidats.push({
        id: p.wikidata_id,
        nom: p.nom,
        ddn: p.ddn ?? "",
        description: p.description,
        photo: p.photo ?? "",
        wikidata_id: p.wikidata_id,
      });

      if (candidats.length === 5) break;
    }

    return NextResponse.json(
      { candidats },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (err: unknown) {
    if (err instanceof WikidataRateLimitError) {
      return NextResponse.json({ error: "rate_limit" }, { status: 429 });
    }
    const isTimeout =
      err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");

    console.error("Erreur recherche Wikidata:", err);

    return NextResponse.json(
      { error: isTimeout ? "timeout" : "server_error" },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
