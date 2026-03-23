// app/api/paris/route.ts
//
// POST /api/paris
// Crée un pari pour l'utilisateur authentifié.
// Toute la validation se passe côté serveur — le client ne contrôle jamais
// le candidat_id directement, seulement le wikidata_id.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServerClient';
import { createClient } from '@supabase/supabase-js';

const MAX_PARIS_PAR_SAISON = 10;

export async function POST(request: NextRequest): Promise<NextResponse> {

  // ── 1. Authentifier l'utilisateur via le token JWT ───────────────────────
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const token = authHeader.slice(7);

  // Client avec le token de l'utilisateur pour valider son identité
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

  // ── 4. Vérifier que le candidat existe en base et est vivant ────────────
  //    Le client ne fournit que le wikidata_id — on résout le candidat_id côté serveur.
  const { data: existingCandidat } = await supabase
    .from('candidats')
    .select('id, ddd')
    .eq('wikidata_id', wikidataId)
    .maybeSingle();

  if (existingCandidat?.ddd) {
    return NextResponse.json({ error: 'Ce candidat est déjà décédé' }, { status: 422 });
  }

  // ── 5. Upsert du candidat si inconnu ─────────────────────────────────────
  //    Si le candidat n'existe pas encore en base, on l'insère à partir des
  //    données fournies par le client — mais on ne fait jamais confiance au
  //    candidat_id côté client, seulement au wikidata_id.
  let candidatId: number;

  if (existingCandidat) {
    candidatId = existingCandidat.id;
  } else {
    // Données optionnelles fournies par le client pour pré-remplir le candidat
    const nom         = typeof body.nom         === 'string' ? body.nom.trim().slice(0, 200)         : wikidataId;
    const ddn         = typeof body.ddn         === 'string' ? body.ddn                              : null;
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '';
    const photo       = typeof body.photo       === 'string' ? body.photo.trim().slice(0, 500)       : '';

    const { data: inserted, error: insertError } = await supabase
      .from('candidats')
      .upsert(
        { nom, ddn, ddd: null, description, photo, wikidata_id: wikidataId },
        { onConflict: 'wikidata_id', ignoreDuplicates: true }
      )
      .select('id')
      .maybeSingle();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    if (inserted) {
      candidatId = inserted.id;
    } else {
      // Race condition : un autre requête a inséré entre-temps
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
