// app/api/admin/broadcast/route.ts
//
// Envoie un email à tous les joueurs inscrits (adresse confirmée).
// Protégé par CRON_SECRET — ne jamais exposer publiquement.
//
// POST /api/admin/broadcast
// Header : Authorization: Bearer <CRON_SECRET>
// Body   : { subject: string, html: string }

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/supabaseServerClient';
import { adressesConfirmees, envoyerATous } from '@/lib/envoiGroupe';

export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.subject || !body?.html) {
    return NextResponse.json({ error: 'subject et html requis' }, { status: 400 });
  }

  try {
    const result = await envoyerATous(await adressesConfirmees(), body.subject, body.html);
    console.log(`[broadcast] Terminé — envoyés: ${result.sent}, échoués: ${result.failed}`);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
