// app/api/admin/broadcast/route.ts
//
// Envoie un email à tous les joueurs inscrits.
// Protégé par CRON_SECRET — ne jamais exposer publiquement.
//
// POST /api/admin/broadcast
// Header : Authorization: Bearer <CRON_SECRET>
// Body   : { subject: string, html: string }

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServerClient';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === 'development';
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn('[broadcast] RESEND_API_KEY manquante'); return false; }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Le Jeu de la Mort <noreply@news.lejeudelamort.fr>',
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  });

  if (!res.ok) { console.error('[broadcast] Erreur Resend:', await res.text()); return false; }
  return true;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.subject || !body?.html) {
    return NextResponse.json({ error: 'subject et html requis' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: usersData, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const emails = (usersData?.users ?? [])
    .map((u: { email?: string; email_confirmed_at?: string }) => u.email)
    .filter((e): e is string => !!e);

  let sent = 0, failed = 0;

  for (const email of emails) {
    const ok = await sendEmail({ to: email, subject: body.subject, html: body.html });
    ok ? sent++ : failed++;
    // Petite pause pour ne pas dépasser le rate limit Resend (100 req/s)
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`[broadcast] Terminé — envoyés: ${sent}, échoués: ${failed}`);
  return NextResponse.json({ total: emails.length, sent, failed });
}