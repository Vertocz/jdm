// app/api/cron/nouvelle-saison/route.ts
//
// Le 1er janvier : email d'ouverture de saison à tous les joueurs (adresse confirmée),
// avec le vainqueur de la saison passée et les personnalités mortes pendant l'année.
// Planifié dans vercel.json, après le passage de check-deaths de la nuit.
//
// GET /api/cron/nouvelle-saison
// Header : Authorization: Bearer <CRON_SECRET>
// Paramètres facultatifs :
//   saison=2027  saison à ouvrir (par défaut : la saison du jour)
//   html=1       renvoie l'email sans l'envoyer (aperçu dans le navigateur)
//   apercu=1     envoie uniquement à ADMIN_EMAIL

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, fetchAllRows, isCronAuthorized } from '@/lib/supabaseServerClient';
import { adressesConfirmees, appUrl, envoyerATous } from '@/lib/envoiGroupe';
import { mailNouvelleSaison, type Vainqueur, type MortDeLAnnee } from '@/lib/emails/nouvelleSaison';
import { saisonEnCours } from '@/lib/regles';

export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const saison = Number(params.get('saison') ?? saisonEnCours());
  if (!Number.isInteger(saison) || saison < 2000) {
    return NextResponse.json({ error: 'saison invalide' }, { status: 400 });
  }
  const saisonPassee = saison - 1;
  const supabase = createServerClient();

  // ── Vainqueur(s) de la saison passée (ex æquo compris) ───────────────────
  const { data: classement, error: ce } = await supabase.rpc('classement', { p_saison: saisonPassee });
  if (ce) return NextResponse.json({ error: `Classement : ${ce.message}` }, { status: 500 });
  const vainqueurs: Vainqueur[] = ((classement ?? []) as (Vainqueur & { rang: number; paris_gagnants: number })[])
    .filter(j => j.rang === 1 && j.paris_gagnants > 0);

  // ── Personnalités mortes pendant la saison passée ────────────────────────
  let morts: MortDeLAnnee[];
  try {
    morts = await fetchAllRows<MortDeLAnnee>((from, to) => supabase
      .from('candidats').select('id, nom')
      .gte('ddd', `${saisonPassee}-01-01`).lte('ddd', `${saisonPassee}-12-31`)
      .order('ddd').order('id').range(from, to));
  } catch (err) {
    return NextResponse.json({ error: `Décès : ${(err as Error).message}` }, { status: 500 });
  }

  const { subject, html } = mailNouvelleSaison({ saison, vainqueurs, morts, url: appUrl() });

  if (params.get('html') === '1') {
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  let destinataires: string[];
  if (params.get('apercu') === '1') {
    if (!process.env.ADMIN_EMAIL) return NextResponse.json({ error: 'ADMIN_EMAIL manquante' }, { status: 400 });
    destinataires = [process.env.ADMIN_EMAIL];
  } else {
    destinataires = await adressesConfirmees();
  }

  try {
    const result = await envoyerATous(destinataires, subject, html);
    console.log(`[nouvelle-saison] ${saison} — envoyés: ${result.sent}, échoués: ${result.failed}`);
    return NextResponse.json({ saison, vainqueurs: vainqueurs.length, morts: morts.length, ...result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
