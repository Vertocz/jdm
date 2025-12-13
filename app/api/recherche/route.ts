// app/api/recherche/route.ts
import { NextRequest, NextResponse } from "next/server";

const WIKIDATA_URL = "https://www.wikidata.org/w/api.php";

interface CandidatWikidata {
  id: string;
  nom: string;
  ddn: string;
  description: string;
  photo: string;
  wikidata_id: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ candidats: [] });
  }

  try {
    // 1. Recherche d'entités Wikidata
    const searchResponse = await fetch(
      `${WIKIDATA_URL}?` +
        new URLSearchParams({
          action: "wbsearchentities",
          language: "fr",
          uselang: "fr",
          format: "json",
          search: query,
          limit: "10", // On prend 10 pour filtrer ensuite
        })
    );

    const searchData = await searchResponse.json();

    if (!searchData.search || searchData.search.length === 0) {
      return NextResponse.json({ candidats: [] });
    }

    // 2. Pour chaque résultat, récupérer les claims (date de naissance, décès, photo)
    const candidatsPromises = searchData.search.map(async (item: any) => {
      const entityId = item.id;

      const claimsResponse = await fetch(
        `${WIKIDATA_URL}?` +
          new URLSearchParams({
            action: "wbgetclaims",
            entity: entityId,
            props: "value",
            format: "json",
          })
      );

      const claimsData = await claimsResponse.json();
      const claims = claimsData.claims || {};

      // Vérifier que la personne est vivante (P569 = date de naissance, P570 = date de décès)
      const hasDateNaissance = "P569" in claims;
      const hasDateDeces = "P570" in claims;

      if (!hasDateNaissance || hasDateDeces) {
        return null; // Pas vivant ou pas de date de naissance
      }

      // Extraire les données
      let ddn = "";
      try {
        const dateStr = claims.P569[0].mainsnak.datavalue.value.time;
        // Format Wikidata: +1990-05-15T00:00:00Z
        const match = dateStr.match(/\+(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          ddn = `${match[1]}-${match[2]}-${match[3]}`; // Format YYYY-MM-DD
        }
      } catch (e) {
        console.error("Erreur parsing date:", e);
      }

      let photo = "";
      try {
        if (claims.P18 && claims.P18[0]) {
          photo = claims.P18[0].mainsnak.datavalue.value.replace(/ /g, "_");
        }
      } catch (e) {
        // Pas de photo
      }

      const candidat: CandidatWikidata = {
        id: entityId,
        nom: item.display?.label?.value || item.label,
        ddn: ddn,
        description: item.description || "",
        photo: photo,
        wikidata_id: entityId,
      };

      return candidat;
    });

    const candidats = (await Promise.all(candidatsPromises))
      .filter((c) => c !== null)
      .slice(0, 5); // Limiter à 5 résultats

    return NextResponse.json({ candidats });
  } catch (error) {
    console.error("Erreur recherche Wikidata:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recherche" },
      { status: 500 }
    );
  }
}