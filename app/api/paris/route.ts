// app/api/paris/route.ts
//
// POST /api/paris
// Crée un pari pour l'utilisateur authentifié.
// Le candidat est systématiquement vérifié sur Wikidata côté serveur —
// le client ne fournit que le wikidata_id, toutes les données viennent de Wikidata.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServerClient';
import { createClient } from '@supabase/supabase-js';

const MAX_PARIS_PAR_SAISON = 10;
const WIKIDATA_URL         = 'https://www.wikidata.org/w/api.php';
const WIKIDATA_TIMEOUT_MS  = 8_000;

// IDENTIFICATION POUR WIKIDATA (obligatoire pour éviter les erreurs 429)
const WIKIDATA_HEADERS = {
  'User-Agent': 'LeJeuDeLaMort/1.0 (contact: victor_creze@hotmail.com) NextJS-App',
  'Accept': 'application/json',
};

// ─── Wikidata ─────────────────────────────────────────────────────────────────

interface WikidataCandidat {
  nom: string;
  ddn: string | null;
  ddd: string | null;
  photo: string | null;
  description: string;
}

async function fetchFromWikidata(wikidataId: string): Promise<WikidataCandidat | null> {
  const res = await fetch(
    `${WIKIDATA_URL}?${new URLSearchParams({
      action:    'wbgetentities',
      ids:       wikidataId,
      props:     'claims|labels|descriptions',
      languages: 'fr|en',
      format:    'json',
    })}`,
    { signal: AbortSignal.timeout(WIKIDATA_TIMEOUT_MS), headers: WIKIDATA_HEADERS }
  );

  if (res.status === 429) throw new Error('Wikidata HTTP 429: Too Many Requests');
  if (!res.ok) return null;

  const data   = await res.json();
  const entity = data.entities?.[wikidataId];
  if (!entity || entity.missing !== undefined) return null;

  const claims = entity.claims ?? {};

  // Doit avoir une date de naissance (P569) — sinon ce n'est pas une personne
  if (!('P569' in claims)) return null;

  // Déjà décédé (P570) — on laisse passer pour afficher l'erreur côté client
  let ddd: string | null = null;
  try {
    const t = claims.P570?.[0]?.mainsnak?.datavalue?.value?.time as string | undefined;
    if (t) {
      const m = t.match(/\+(\d{4})-(\d{2})-(\d{2})/);
      if (m) ddd = `${m[1]}-${m[2]}-${m[3]}`;
    }
  } catch { /* pas de date de décès */ }

  // Date de naissance
  let ddn: string | null = null;
  try {
    const t = claims.P569[0].mainsnak.datavalue.value.time as string;
    const m = t.match(/\+(\d{4})-(\d{2})-(\d{2})/);
    if (m) ddn = `${m[1]}-${m[2]}-${m[3]}`;
  } catch { /* date malformée */ }

  // Photo (P18)
  let photo: string | null = null;
  try {
    const raw = claims.P18?.[0]?.mainsnak?.datavalue?.value as string | undefined;
    if (raw) photo = raw.replace(/ /g, '_');
  } catch { /* pas de photo */ }

  const nom = entity.labels?.fr?.value || entity.labels?.en?.value || wikidataId;
  const description = entity.descriptions?.fr?.value || entity.descriptions?.en?.value || '';

  return { nom, ddn, ddd, photo, description };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {

  // ── 1. Authentifier l'utilisateur via le token JWT ───────────────────────
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
  }

  // ── 2. Valider le body ───────────────────────────────────────────────────
  const body = await request.json().catch(() => null);
  const wikidataId: string = body?.wikidata_id?.trim();
  const saison: number     = body?.saison;

  if (!wikidataId || !wikidataId.match(/^Q\d+$/)) {
    return NextResponse.json({ error: 'wikidata_id invalide' }, { status: 400 });
  }
  if (!saison || saison < 2020 || saison > new Date().getFullYear()) {
    return NextResponse.json({ error: 'Saison invalide' }, { status: 400 });
  }

  const supabase = createServerClient();

  // ── 3. Vérifier la limite de paris actifs ────────────────────────────────
  const { count: activeCount, error: countError } = await supabase
    .from('paris')
    .select('*', { count: 'exact', head: true })
    .eq('joueur', user.id)
    .eq('saison', saison)
    .eq('mort', false);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if (activeCount !== null && activeCount >= MAX_PARIS_PAR_SAISON) {
    return NextResponse.json({ error: `Maximum ${MAX_PARIS_PAR_SAISON} candidats actifs par saison` }, { status: 422 });
  }

  // ── 4. Candidat déjà en base ? ───────────────────────────────────────────
  const { data: existingCandidat } = await supabase
    .from('candidats')
    .select('id, ddd')
    .eq('wikidata_id', wikidataId)
    .maybeSingle();

  if (existingCandidat?.ddd) {
    return NextResponse.json({ error: 'Ce candidat est déjà décédé' }, { status: 422 });
  }

  let candidatId: number;

  if (existingCandidat) {
    // Candidat connu — on fait confiance aux données déjà en base
    candidatId = existingCandidat.id;
  } else {
    // ── 5. Candidat inconnu — vérification sur Wikidata ──────────────────
    //    On ne fait JAMAIS confiance aux données du client.
    let wikidataData: WikidataCandidat | null;
    try {
      wikidataData = await fetchFromWikidata(wikidataId);
    } catch (err) {
      const isRateLimit = (err as Error)?.message?.includes('429');
      return NextResponse.json(
        { error: isRateLimit
            ? 'Wikidata est temporairement indisponible. Réessaie dans quelques instants.'
            : 'Impossible de vérifier le candidat sur Wikidata'
        },
        { status: isRateLimit ? 429 : 503 }
      );
    }

    if (!wikidataData) {
      return NextResponse.json({ error: 'Candidat introuvable sur Wikidata' }, { status: 422 });
    }

    if (wikidataData.ddd) {
      return NextResponse.json({ error: 'Ce candidat est déjà décédé' }, { status: 422 });
    }

    // Tout vient de Wikidata — rien du client
    const { data: inserted, error: insertError } = await supabase
      .from('candidats')
      .upsert(
        {
          nom:         wikidataData.nom,
          ddn:         wikidataData.ddn,
          ddd:         null,
          description: wikidataData.description,
          photo:       wikidataData.photo ?? '',
          wikidata_id: wikidataId,
        },
        { onConflict: 'wikidata_id', ignoreDuplicates: true }
      )
      .select('id')
      .maybeSingle();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    if (inserted) {
      candidatId = inserted.id;
    } else {
      // Race condition
      const { data: refetch } = await supabase
        .from('candidats').select('id').eq('wikidata_id', wikidataId).single();
      if (!refetch) return NextResponse.json({ error: 'Candidat introuvable' }, { status: 500 });
      candidatId = refetch.id;
    }
  }

  // ── 6. Vérifier l'unicité du pari ────────────────────────────────────────
  const { count: dupeCount } = await supabase
    .from('paris')
    .select('*', { count: 'exact', head: true })
    .eq('joueur', user.id)
    .eq('candidat_id', candidatId)
    .eq('saison', saison);

  if (dupeCount && dupeCount > 0) {
    return NextResponse.json({ error: 'Vous avez déjà parié sur ce candidat cette saison' }, { status: 422 });
  }

  // ── 7. Créer le pari ─────────────────────────────────────────────────────
  const { error: pariError } = await supabase
    .from('paris')
    .insert({ candidat_id: candidatId, joueur: user.id, saison, mort: false });

  if (pariError) {
    if (pariError.code === '23505') {
      return NextResponse.json({ error: 'Vous avez déjà parié sur ce candidat cette saison' }, { status: 422 });
    }
    return NextResponse.json({ error: pariError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, candidat_id: candidatId });
}