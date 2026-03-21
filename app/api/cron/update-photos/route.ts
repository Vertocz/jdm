// app/api/cron/update-photos/route.ts
//
// Déclenché chaque lundi à 3h00 par Vercel Cron (vercel.json).
// Peut aussi être appelé manuellement : GET /api/cron/update-photos
//
// Algorithme :
//   1. Récupère tous les candidats en base qui ont un wikidata_id
//   2. Interroge Wikidata par lots de 50 (claim P18 = photo)
//   3. Pour chaque candidat dont la photo a changé (ou est nouvelle),
//      met à jour candidats.photo en base

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServerClient';

const WIKIDATA_URL          = 'https://www.wikidata.org/w/api.php';
const WIKIDATA_BATCH_SIZE   = 50;
const WIKIDATA_TIMEOUT_MS   = 15_000;
const DELAY_BETWEEN_BATCHES = 500;

// ─── Sécurité ────────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === 'development';
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), WIKIDATA_TIMEOUT_MS);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Interroge Wikidata pour un lot d'entités.
 * Retourne une map { wikidata_id → nom_fichier_photo | null }
 */
async function fetchPhotosBatch(ids: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();

  const res = await fetchWithTimeout(
    `${WIKIDATA_URL}?${new URLSearchParams({
      action : 'wbgetentities',
      ids    : ids.join('|'),
      props  : 'claims',
      format : 'json',
    })}`
  );

  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);

  const data     = await res.json();
  const entities = data.entities ?? {};

  for (const id of ids) {
    const entity = entities[id];
    if (!entity || entity.missing !== undefined) { result.set(id, null); continue; }

    try {
      const p18 = entity.claims?.P18?.[0];
      if (p18) {
        // La valeur est directement le nom du fichier (string)
        const filename = (p18.mainsnak.datavalue.value as string).replace(/ /g, '_');
        result.set(id, filename);
      } else {
        result.set(id, null);
      }
    } catch {
      result.set(id, null);
    }
  }

  return result;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const supabase = createServerClient();
  const errors: string[] = [];
  let checked = 0, updated = 0;

  console.log('[cron] Démarrage update-photos');

  // ── 1. Récupérer tous les candidats avec un wikidata_id ──────────────────

  const { data: candidats, error: fetchError } = await supabase
    .from('candidats')
    .select('id, nom, photo, wikidata_id')
    .not('wikidata_id', 'is', null)
    .neq('wikidata_id', '');

  if (fetchError) {
    console.error('[cron] Erreur récupération candidats:', fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const all = candidats ?? [];
  checked   = all.length;
  console.log(`[cron] ${checked} candidats à vérifier`);

  if (checked === 0) {
    return NextResponse.json({ checked: 0, updated: 0, errors: [] });
  }

  // ── 2. Vérifier par lots sur Wikidata ────────────────────────────────────

  for (let i = 0; i < all.length; i += WIKIDATA_BATCH_SIZE) {
    const batch = all.slice(i, i + WIKIDATA_BATCH_SIZE);
    const ids   = batch.map((c: any) => c.wikidata_id);

    try {
      const photoMap = await fetchPhotosBatch(ids);

      for (const candidat of batch) {
        const newPhoto = photoMap.get(candidat.wikidata_id) ?? null;

        // Normalise la photo actuelle pour comparer (même format que Wikidata)
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
            console.log(`[cron] Photo mise à jour : ${candidat.nom} → ${newPhoto}`);
            updated++;
          }
        }
      }
    } catch (err: unknown) {
      const msg = `Erreur Wikidata lot ${Math.floor(i / WIKIDATA_BATCH_SIZE) + 1}: ${err instanceof Error ? err.message : String(err)}`;
      console.error('[cron]', msg);
      errors.push(msg);
    }

    if (i + WIKIDATA_BATCH_SIZE < all.length) {
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  const result = { checked, updated, errors };
  console.log('[cron] Terminé :', result);
  return NextResponse.json(result);
}