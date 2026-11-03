// app/api/cron/update-photos/route.ts
//
// Déclenché chaque lundi à 3h00 UTC par Vercel Cron (vercel.json).
// Peut aussi être appelé manuellement : GET /api/cron/update-photos
// (en-tête Authorization: Bearer <CRON_SECRET>).
//
// Algorithme :
//   1. Récupère tous les candidats en base qui ont un wikidata_id
//   2. Interroge Wikidata par lots de 50 (claim P18 = photo)
//   3. Pour chaque candidat dont la photo a changé (ou est nouvelle),
//      met à jour candidats.photo en base

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, fetchAllRows, isCronAuthorized } from '@/lib/supabaseServerClient';
import { bestClaimValue, getEntities } from '@/lib/wikidata';

export const maxDuration = 300;

const WIKIDATA_BATCH_SIZE   = 50;
const WIKIDATA_TIMEOUT_MS   = 15_000;
const DELAY_BETWEEN_BATCHES = 500;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface CandidatPhoto { id: number; nom: string; photo: string | null; wikidata_id: string }

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const supabase = createServerClient();
  const errors: string[] = [];
  let updated = 0;

  console.log('[cron] Démarrage update-photos');

  // ── 1. Récupérer tous les candidats avec un wikidata_id ──────────────────
  let all: CandidatPhoto[];
  try {
    all = await fetchAllRows<CandidatPhoto>((from, to) => supabase
      .from('candidats')
      .select('id, nom, photo, wikidata_id')
      .not('wikidata_id', 'is', null)
      .neq('wikidata_id', '')
      .order('id')
      .range(from, to));
  } catch (err) {
    console.error('[cron] Erreur récupération candidats:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  console.log(`[cron] ${all.length} candidats à vérifier`);

  // ── 2. Vérifier par lots sur Wikidata ────────────────────────────────────
  for (let i = 0; i < all.length; i += WIKIDATA_BATCH_SIZE) {
    const batch = all.slice(i, i + WIKIDATA_BATCH_SIZE);

    try {
      const entities = await getEntities(batch.map(c => c.wikidata_id), 'claims', WIKIDATA_TIMEOUT_MS);

      for (const candidat of batch) {
        const raw = bestClaimValue<string>(entities[candidat.wikidata_id]?.claims, 'P18');
        const newPhoto = raw ? raw.replace(/ /g, '_') : null;
        const currentPhoto = candidat.photo?.replace(/ /g, '_') ?? null;

        // Met à jour seulement si la photo a changé ou est nouvelle
        if (newPhoto !== null && newPhoto !== currentPhoto) {
          const { error: updateError } = await supabase
            .from('candidats')
            .update({ photo: newPhoto })
            .eq('id', candidat.id);

          if (updateError) {
            const msg = `Erreur update photo ${candidat.nom} (${candidat.id}): ${updateError.message}`;
            console.error('[cron]', msg);
            errors.push(msg);
          } else {
            updated++;
          }
        }
      }
    } catch (err: unknown) {
      const msg = `Erreur Wikidata lot ${Math.floor(i / WIKIDATA_BATCH_SIZE) + 1}: ${err instanceof Error ? err.message : String(err)}`;
      console.error('[cron]', msg);
      errors.push(msg);
    }

    if (i + WIKIDATA_BATCH_SIZE < all.length) await sleep(DELAY_BETWEEN_BATCHES);
  }

  const result = { checked: all.length, updated, errors };
  console.log('[cron] Terminé :', result);
  return NextResponse.json(result);
}
