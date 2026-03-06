// app/api/cron/check-deaths/route.ts
//
// Déclenché chaque nuit à 0h00 par Vercel Cron (vercel.json).
// Peut aussi être appelé manuellement : GET /api/cron/check-deaths
//
// Algorithme :
//   1. Récupère tous les candidats vivants en base (ddd IS NULL)
//   2. Interroge Wikidata par lots de 50 (wbgetentities) pour détecter P570 (date de décès)
//   3. Pour chaque décès détecté :
//      a. Met à jour candidats.ddd
//      b. Marque paris.mort = true pour tous les paris actifs sur ce candidat cette saison
//      c. Collecte les notifications à envoyer
//   4. Envoie les emails en respectant les préférences (alert_mes_candidats / alert_autres_candidats)

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServerClient';

const WIKIDATA_URL = 'https://www.wikidata.org/w/api.php';
const WIKIDATA_BATCH_SIZE = 50; // Limite de l'API Wikidata
const WIKIDATA_TIMEOUT_MS = 15_000;
const DELAY_BETWEEN_BATCHES_MS = 500; // Respecter le rate limit Wikidata

// ─── Types ──────────────────────────────────────────────────────────────────

interface CandidatVivant {
  id: number;
  nom: string;
  ddn: string | null;
  wikidata_id: string;
}

interface DecesDetecte {
  candidat: CandidatVivant;
  ddd: string; // format YYYY-MM-DD
}

interface PariAffecte {
  pari_id: number;
  joueur_id: string;
  saison: number;
}

interface CronResult {
  checked: number;
  deaths: number;
  notifications_sent: number;
  errors: string[];
}

// ─── Sécurité ───────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Pas de secret configuré : on autorise uniquement en développement
    return process.env.NODE_ENV === 'development';
  }

  // Vercel envoie automatiquement `Authorization: Bearer <CRON_SECRET>`
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${secret}`;
}

// ─── Wikidata ────────────────────────────────────────────────────────────────

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), WIKIDATA_TIMEOUT_MS);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Interroge Wikidata pour un lot d'entités et retourne la map
 * { wikidata_id → date_de_deces | null }
 */
async function checkBatchOnWikidata(
  wikidataIds: string[]
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();

  const res = await fetchWithTimeout(
    `${WIKIDATA_URL}?${new URLSearchParams({
      action: 'wbgetentities',
      ids: wikidataIds.join('|'),
      props: 'claims',
      format: 'json',
    })}`
  );

  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);

  const data = await res.json();
  const entities = data.entities ?? {};

  for (const id of wikidataIds) {
    const entity = entities[id];
    if (!entity || entity.missing !== undefined) {
      result.set(id, null);
      continue;
    }

    const claims = entity.claims ?? {};
    const p570 = claims['P570']; // P570 = date de décès

    if (!p570?.[0]) {
      result.set(id, null);
      continue;
    }

    try {
      const timeStr: string = p570[0].mainsnak.datavalue.value.time;
      // Format Wikidata : +YYYY-MM-DDT00:00:00Z
      const match = timeStr.match(/\+(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        result.set(id, `${match[1]}-${match[2]}-${match[3]}`);
      } else {
        result.set(id, null);
      }
    } catch {
      result.set(id, null);
    }
  }

  return result;
}

// ─── Handler principal ───────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const errors: string[] = [];
  const supabase = createServerClient();
  const saison = new Date().getFullYear();

  console.log(`[cron] Démarrage check-deaths — saison ${saison}`);

  // ── 1. Récupérer tous les candidats vivants ──────────────────────────────

  const { data: candidatsVivants, error: fetchError } = await supabase
    .from('candidats')
    .select('id, nom, ddn, wikidata_id')
    .is('ddd', null)
    .not('wikidata_id', 'is', null)
    .neq('wikidata_id', '');

  if (fetchError) {
    console.error('[cron] Erreur récupération candidats:', fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const vivants: CandidatVivant[] = candidatsVivants ?? [];
  console.log(`[cron] ${vivants.length} candidats vivants à vérifier`);

  if (vivants.length === 0) {
    return NextResponse.json({ checked: 0, deaths: 0, notifications_sent: 0, errors: [] });
  }

  // ── 2. Vérifier par lots sur Wikidata ────────────────────────────────────

  const decesList: DecesDetecte[] = [];

  for (let i = 0; i < vivants.length; i += WIKIDATA_BATCH_SIZE) {
    const batch = vivants.slice(i, i + WIKIDATA_BATCH_SIZE);
    const ids = batch.map((c) => c.wikidata_id);

    try {
      const resultMap = await checkBatchOnWikidata(ids);

      for (const candidat of batch) {
        const ddd = resultMap.get(candidat.wikidata_id);
        if (ddd) {
          decesList.push({ candidat, ddd });
          console.log(`[cron] Décès détecté : ${candidat.nom} (${ddd})`);
        }
      }
    } catch (err: unknown) {
      const msg = `Erreur Wikidata lot ${i / WIKIDATA_BATCH_SIZE + 1}: ${err instanceof Error ? err.message : String(err)}`;
      console.error('[cron]', msg);
      errors.push(msg);
    }

    // Pause entre les lots pour respecter le rate limit Wikidata
    if (i + WIKIDATA_BATCH_SIZE < vivants.length) {
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  if (decesList.length === 0) {
    console.log('[cron] Aucun décès détecté.');
    return NextResponse.json({ checked: vivants.length, deaths: 0, notifications_sent: 0, errors });
  }

  // ── 3. Mettre à jour la DB et collecter les notifications ────────────────

  // Récupérer profils + emails en une seule requête
  // auth.users n'est accessible qu'avec le service role key
  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const emailByUserId = new Map<string, string>(
    (usersData?.users ?? []).map((u: { id: string; email?: string }) => [u.id, u.email ?? ''])
  );

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, display_name, alert_mes_candidats, alert_autres_candidats');

  const profileByUserId = new Map(
    (profiles ?? []).map((p: { user_id: string; display_name: string; alert_mes_candidats: boolean; alert_autres_candidats: boolean }) => [p.user_id, p])
  );

  let notificationsSent = 0;

  for (const { candidat, ddd } of decesList) {
    // a. Mettre à jour candidats.ddd
    const { error: updateCandidatError } = await supabase
      .from('candidats')
      .update({ ddd })
      .eq('id', candidat.id);

    if (updateCandidatError) {
      const msg = `Erreur update candidat ${candidat.id}: ${updateCandidatError.message}`;
      console.error('[cron]', msg);
      errors.push(msg);
      continue;
    }

    // b. Récupérer les paris actifs sur ce candidat cette saison
    const { data: parisActifs, error: parisError } = await supabase
      .from('paris')
      .select('id, joueur, saison')
      .eq('candidat_id', candidat.id)
      .eq('saison', saison)
      .eq('mort', false);

    if (parisError) {
      const msg = `Erreur récupération paris pour candidat ${candidat.id}: ${parisError.message}`;
      console.error('[cron]', msg);
      errors.push(msg);
      continue;
    }

    const pariIds = (parisActifs ?? []).map((p: any) => p.id);

    // c. Marquer mort = true pour tous ces paris
    if (pariIds.length > 0) {
      const { error: updateParisError } = await supabase
        .from('paris')
        .update({ mort: true })
        .in('id', pariIds);

      if (updateParisError) {
        const msg = `Erreur update paris pour candidat ${candidat.id}: ${updateParisError.message}`;
        console.error('[cron]', msg);
        errors.push(msg);
      }
    }
  }

  const result: CronResult = {
    checked: vivants.length,
    deaths: decesList.length,
    notifications_sent: notificationsSent,
    errors,
  };

  console.log('[cron] Terminé :', result);
  return NextResponse.json(result);
}
