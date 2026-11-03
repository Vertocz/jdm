// app/api/admin/broadcast/route.ts
//
// Envoie un email à tous les joueurs inscrits (adresse confirmée).
// Protégé par CRON_SECRET — ne jamais exposer publiquement.
//
// POST /api/admin/broadcast
// Header : Authorization: Bearer <CRON_SECRET>
// Body   : { subject: string, html: string }

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, isCronAuthorized, listAllUsers } from '@/lib/supabaseServerClient';

export const maxDuration = 300;

const RESEND_BATCH_SIZE = 100;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY manquante' }, { status: 500 });

  const body = await request.json().catch(() => null);
  if (!body?.subject || !body?.html) {
    return NextResponse.json({ error: 'subject et html requis' }, { status: 400 });
  }

  let emails: string[];
  try {
    emails = (await listAllUsers(createServerClient()))
      .filter(u => u.email && u.email_confirmed_at)
      .map(u => u.email!);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://lejeudelamort.fr';
  let sent = 0, failed = 0;

  // Envoi par lots de 100 via l'API batch de Resend
  for (let i = 0; i < emails.length; i += RESEND_BATCH_SIZE) {
    const chunk = emails.slice(i, i + RESEND_BATCH_SIZE);
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk.map(to => ({
        from: 'Le Jeu de la Mort <noreply@news.lejeudelamort.fr>',
        to,
        subject: body.subject,
        html: body.html,
        headers: { 'List-Unsubscribe': `<${appUrl}/gestion>` },
      }))),
    });
    if (res.ok) sent += chunk.length;
    else { failed += chunk.length; console.error('[broadcast] Erreur Resend:', await res.text()); }
    if (i + RESEND_BATCH_SIZE < emails.length) await new Promise(r => setTimeout(r, 700));
  }

  console.log(`[broadcast] Terminé — envoyés: ${sent}, échoués: ${failed}`);
  return NextResponse.json({ total: emails.length, sent, failed });
}
