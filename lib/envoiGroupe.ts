// lib/envoiGroupe.ts
//
// Envoi d'un même email à une liste de joueurs, par lots de 100 (API batch de Resend).
// Utilisé par /api/admin/broadcast et par le cron de nouvelle saison.

import { createServerClient, listAllUsers } from '@/lib/supabaseServerClient';

const FROM = 'Le Jeu de la Mort <noreply@news.lejeudelamort.fr>';
const RESEND_BATCH_SIZE = 100;
const DELAI_ENTRE_LOTS_MS = 700;

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://lejeudelamort.fr';
}

/** Adresses de tous les joueurs inscrits dont l'email est confirmé. */
export async function adressesConfirmees(): Promise<string[]> {
  return (await listAllUsers(createServerClient()))
    .filter(u => u.email && u.email_confirmed_at)
    .map(u => u.email!);
}

export async function envoyerATous(
  emails: string[],
  subject: string,
  html: string,
): Promise<{ total: number; sent: number; failed: number }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY manquante');

  let sent = 0, failed = 0;
  for (let i = 0; i < emails.length; i += RESEND_BATCH_SIZE) {
    const chunk = emails.slice(i, i + RESEND_BATCH_SIZE);
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk.map(to => ({
        from: FROM,
        to,
        subject,
        html,
        headers: { 'List-Unsubscribe': `<${appUrl()}/gestion>` },
      }))),
    });
    if (res.ok) sent += chunk.length;
    else { failed += chunk.length; console.error('[envoi groupé] Erreur Resend:', await res.text()); }
    if (i + RESEND_BATCH_SIZE < emails.length) await new Promise(r => setTimeout(r, DELAI_ENTRE_LOTS_MS));
  }
  return { total: emails.length, sent, failed };
}
