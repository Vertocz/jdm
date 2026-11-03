// app/api/paris/route.ts
//
// POST /api/paris
// Crée un pari pour l'utilisateur authentifié, sur la saison en cours.
// Le candidat est TOUJOURS revérifié sur Wikidata, même s'il est déjà en base :
// les décès ne sont enregistrés qu'une fois par nuit, il ne faut pas pouvoir
// parier entre-temps sur une personne qui vient de mourir.
// Le client ne fournit que le wikidata_id ; toutes les données viennent de Wikidata.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabaseServerClient';
import { entityToPersonne, getEntities, WikidataRateLimitError, type WikidataPersonne } from '@/lib/wikidata';
import { annee, aujourdhuiParis } from '@/lib/regles';

const MAX_PARIS_PAR_SAISON = 10;

export async function POST(request: NextRequest): Promise<NextResponse> {

  // ── 1. Authentifier l'utilisateur via le token JWT ───────────────────────
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
  }

  // ── 2. Valider le body ───────────────────────────────────────────────────
  const body = await request.json().catch(() => null);
  const wikidataId: string | undefined = typeof body?.wikidata_id === 'string' ? body.wikidata_id.trim() : undefined;
  const saisonEnCours = annee(aujourdhuiParis());
  const saison = body?.saison ?? saisonEnCours;

  if (!wikidataId || !/^Q\d+$/.test(wikidataId)) {
    return NextResponse.json({ error: 'wikidata_id invalide' }, { status: 400 });
  }
  if (saison !== saisonEnCours) {
    return NextResponse.json({ error: `On ne peut parier que sur la saison ${saisonEnCours}` }, { status: 400 });
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

  // ── 4. Vérification Wikidata (systématique) ──────────────────────────────
  let personne: WikidataPersonne;
  try {
    const entities = await getEntities([wikidataId]);
    const entity = entities[wikidataId];
    if (!entity || entity.missing !== undefined) {
      return NextResponse.json({ error: 'Candidat introuvable sur Wikidata' }, { status: 422 });
    }
    personne = entityToPersonne(wikidataId, entity);
  } catch (err) {
    const isRateLimit = err instanceof WikidataRateLimitError;
    return NextResponse.json(
      { error: isRateLimit
          ? 'Wikidata est temporairement indisponible. Réessaie dans quelques instants.'
          : 'Impossible de vérifier le candidat sur Wikidata' },
      { status: isRateLimit ? 429 : 503 },
    );
  }

  if (!personne.estPersonne || !personne.ddn) {
    return NextResponse.json({ error: 'Candidat introuvable sur Wikidata' }, { status: 422 });
  }

  // ── 5. Candidat déjà en base ? ───────────────────────────────────────────
  const { data: existing } = await supabase
    .from('candidats')
    .select('id, ddd')
    .eq('wikidata_id', wikidataId)
    .maybeSingle();

  if (personne.decede || existing?.ddd) {
    // Le cron de la nuit traitera le décès (paris, classement, emails).
    return NextResponse.json({ error: 'Ce candidat est déjà décédé' }, { status: 422 });
  }

  let candidatId: number;

  if (existing) {
    candidatId = existing.id;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('candidats')
      .upsert(
        {
          nom:         personne.nom,
          ddn:         personne.ddn,
          ddd:         null,
          description: personne.description,
          photo:       personne.photo ?? '',
          wikidata_id: wikidataId,
        },
        { onConflict: 'wikidata_id', ignoreDuplicates: true },
      )
      .select('id')
      .maybeSingle();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    if (inserted) {
      candidatId = inserted.id;
    } else {
      // Inséré entre-temps par une autre requête
      const { data: refetch } = await supabase
        .from('candidats').select('id').eq('wikidata_id', wikidataId).single();
      if (!refetch) return NextResponse.json({ error: 'Candidat introuvable' }, { status: 500 });
      candidatId = refetch.id;
    }
  }

  // ── 6. Créer le pari (unicité garantie par la contrainte en base) ────────
  const { error: pariError } = await supabase
    .from('paris')
    .insert({ candidat_id: candidatId, joueur: user.id, saison, mort: false });

  if (pariError) {
    if (pariError.code === '23505') {
      return NextResponse.json({ error: 'Vous avez déjà parié sur ce candidat cette saison' }, { status: 422 });
    }
    if (pariError.message.includes('10 paris')) {
      return NextResponse.json({ error: `Maximum ${MAX_PARIS_PAR_SAISON} candidats actifs par saison` }, { status: 422 });
    }
    return NextResponse.json({ error: pariError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, candidat_id: candidatId });
}
