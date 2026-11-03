// app/api/cron/check-deaths/route.ts
//
// Déclenché chaque nuit à 23h59 UTC par Vercel Cron (vercel.json).
// Peut aussi être appelé manuellement : GET /api/cron/check-deaths
// (en-tête Authorization: Bearer <CRON_SECRET>).
//
// 1. Interroge Wikidata pour tous les candidats encore vivants en base.
// 2. Pour chaque décès : enregistre la date, marque les paris de la saison
//    du décès (l'année de la date de décès, pas l'année courante : un décès
//    du 30 décembre connu le 2 janvier compte pour la saison précédente).
// 3. Recalcule les rangs (table victoires) des saisons touchées, en base.
// 4. Envoie les emails selon les préférences de chacun.
// 5. En cas d'erreur, prévient l'administrateur (ADMIN_EMAIL) si configuré.

import { NextRequest, NextResponse } from 'next/server';
import {
  createServerClient, fetchAllRows, isCronAuthorized, listAllUsers,
} from '@/lib/supabaseServerClient';
import { calculAge, pointsPourAge, escapeHtml } from '@/lib/deathCard';
import { annee, pariGagnant } from '@/lib/regles';
import { bestClaimValue, getEntities, hasClaim, parseWikidataDate } from '@/lib/wikidata';

export const maxDuration = 300;

const WIKIDATA_BATCH_SIZE = 50;
const WIKIDATA_TIMEOUT_MS = 15_000;
const DELAY_BETWEEN_BATCHES_MS = 500;

// Limite de l'API batch Resend (max 100 emails par appel) + marge de sécurité
// entre deux lots pour rester sous la limite de débit.
const RESEND_BATCH_SIZE = 100;
const DELAY_BETWEEN_RESEND_BATCHES_MS = 700;
const FROM = 'Le Jeu de la Mort <noreply@news.lejeudelamort.fr>';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CandidatVivant {
  id: number;
  nom: string;
  ddn: string | null;
  ddd: string | null;
  wikidata_id: string;
  photo: string | null;
}
interface DecesDetecte {
  candidat: CandidatVivant;
  ddd: string;
  saison: number;         // saison du décès
  gagnants: string[];     // joueurs qui marquent des points
  // userId -> saisons antérieures où ce joueur avait parié sur ce candidat
  // sans le reprendre pour la saison du décès.
  ancienParieurs: Map<string, number[]>;
}
interface RankRow { user_id: string; rang: number; total_points: number }
interface CronResult { checked: number; deaths: number; notifications_sent: number; errors: string[] }
interface EmailToSend { to: string; subject: string; html: string }
interface Profile { user_id: string; display_name: string | null; alert_mes_candidats: boolean | null; alert_autres_candidats: boolean | null }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://lejeudelamort.fr';
}

// ─── Wikidata ─────────────────────────────────────────────────────────────────

/** wikidata_id → date de décès ("YYYY-MM-DD"), "illisible", ou absent si vivant. */
async function checkBatchOnWikidata(ids: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const entities = await getEntities(ids, 'claims', WIKIDATA_TIMEOUT_MS);
  for (const id of ids) {
    const claims = entities[id]?.claims;
    if (!hasClaim(claims, 'P570')) continue;
    result.set(id, parseWikidataDate(bestClaimValue(claims, 'P570')) ?? 'illisible');
  }
  return result;
}

// ─── Helpers d'affichage propres à l'email ────────────────────────────────────

function ordinal(n: number): string {
  return n === 1 ? '1er' : `${n}ème`;
}
function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(', ') + ' et ' + names[names.length - 1];
}
function joinYears(years: number[]): string {
  const sorted = [...years].sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  if (sorted.length === 1) return `en ${sorted[0]}`;
  return `en ${sorted.slice(0, -1).join(', ')} et ${sorted[sorted.length - 1]}`;
}

// ─── Email ────────────────────────────────────────────────────────────────────

function buildEmailHtml(opts: {
  displayName: string;
  candidat: CandidatVivant;
  ddd: string;
  saison: number;
  saisonCourante: number;
  isMine: boolean;
  isAncienParieur: boolean;
  anciennesSaisons: number[];
  rank: number | null;
  gainedPts: number;
  scorersNames: string[]; // pseudos des joueurs ayant marqué (hors soi-même)
}): string {
  const { candidat, ddd, saison, saisonCourante, isMine, isAncienParieur, anciennesSaisons, rank, gainedPts } = opts;

  // Tout ce qui vient des joueurs ou de Wikidata est échappé.
  const nom = escapeHtml(candidat.nom);
  const displayName = escapeHtml(opts.displayName);
  const scorersNames = opts.scorersNames.map(escapeHtml);
  const age = calculAge(candidat.ddn, ddd);
  const pts = `${gainedPts} point${gainedPts > 1 ? 's' : ''}`;
  const saisonStr = saison !== saisonCourante ? ` (saison ${saison})` : '';

  let intro: string;
  if (isMine) {
    const rankStr = rank ? ` Tu es ${ordinal(rank)} du classement${saisonStr}.` : '';
    intro = `+${pts}${saisonStr} !${rankStr}`;
  } else if (isAncienParieur) {
    intro = `Tu avais repéré <strong style="color:#f1ebdb;">${nom}</strong> ${joinYears(anciennesSaisons)}. Fallait persévérer, ça t'aurait rapporté ${pts}.`;
  } else if (scorersNames.length > 0) {
    intro = `${joinNames(scorersNames)} ${scorersNames.length > 1 ? 'marquent des points' : 'marque des points'} avec <strong style="color:#f1ebdb;">${nom}</strong>${saisonStr}.`;
  } else {
    intro = `<strong style="color:#f1ebdb;">${nom}</strong> nous a quitté(e)${age !== null ? ` à ${age} ans` : ''}.`;
  }

  const url = appUrl();
  const cardImageUrl = `${url}/api/og/card?id=${candidat.id}`;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0d0d18;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d18;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

        <tr><td style="background:rgba(241,235,219,0.04);border:1px solid rgba(241,235,219,0.08);border-radius:16px;padding:40px 36px;">
          <p style="margin:0 0 6px;font-size:1.4rem;font-weight:800;color:#f1ebdb;letter-spacing:-0.4px;">
            ${isMine ? `Ça y est<span style="color:#db878f;">.</span>` : `Info<span style="color:#db878f;">.</span>`}
          </p>
          <p style="margin:0 0 32px;font-size:0.72rem;font-weight:300;color:rgba(241,235,219,0.3);letter-spacing:1px;text-transform:uppercase;">
            Bonjour ${displayName},
          </p>
          <p style="margin:0 0 4px;font-size:0.9rem;color:rgba(241,235,219,0.6);line-height:1.7;">${intro}</p>

          <img src="${cardImageUrl}" width="210" height="300" alt="${nom}"
            style="display:block;margin:28px auto 0;width:210px;height:300px;border-radius:16px;">

          <table cellpadding="0" cellspacing="0" width="100%" style="margin-top:32px;"><tr><td align="center">
            <a href="${url}/classement"
              style="display:inline-block;padding:14px 32px;background:#db878f;color:#0d0d18;font-size:0.75rem;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;text-decoration:none;border-radius:10px;white-space:nowrap;">
              Voir le classement
            </a>
          </td></tr></table>
        </td></tr>

        <tr><td align="center" style="padding-top:24px;">
          <p style="margin:0;font-size:0.65rem;color:rgba(241,235,219,0.25);letter-spacing:0.5px;">
            Le Jeu de la Mort · <a href="${url}/gestion" style="color:rgba(241,235,219,0.35);">Gérer mes alertes</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Resend (envoi par lots) ────────────────────────────────────────────────

async function sendEmailBatch(emails: EmailToSend[]): Promise<number> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn('[cron] RESEND_API_KEY manquante — lot non envoyé'); return 0; }

  const payload = emails.map(e => ({
    from: FROM,
    to: e.to,
    subject: e.subject,
    html: e.html,
    headers: { 'List-Unsubscribe': `<${appUrl()}/gestion>` },
  }));

  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return emails.length;

    if (res.status === 429) {
      const retryAfterHeader = Number(res.headers.get('retry-after'));
      const wait = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
        ? retryAfterHeader * 1000
        : (attempt + 1) * 1000;
      console.warn(`[cron] 429 Resend — retry dans ${wait}ms (tentative ${attempt + 1}/${maxRetries})`);
      await sleep(wait);
      continue;
    }

    console.error('[cron] Erreur Resend batch:', await res.text());
    return 0;
  }
  console.error('[cron] Échec envoi du lot après', maxRetries, 'tentatives (429 persistant)');
  return 0;
}

async function sendAllEmails(emails: EmailToSend[]): Promise<number> {
  let sent = 0;
  for (let i = 0; i < emails.length; i += RESEND_BATCH_SIZE) {
    sent += await sendEmailBatch(emails.slice(i, i + RESEND_BATCH_SIZE));
    if (i + RESEND_BATCH_SIZE < emails.length) await sleep(DELAY_BETWEEN_RESEND_BATCHES_MS);
  }
  return sent;
}

/** Prévient l'administrateur quand le cron a rencontré des erreurs. */
async function alertAdmin(result: CronResult): Promise<void> {
  const to = process.env.ADMIN_EMAIL;
  if (!to || result.errors.length === 0) return;
  const lignes = result.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('');
  await sendEmailBatch([{
    to,
    subject: `[JDM] check-deaths : ${result.errors.length} erreur(s)`,
    html: `<p>${result.checked} candidats vérifiés, ${result.deaths} décès, ${result.notifications_sent} emails envoyés.</p><ul>${lignes}</ul>`,
  }]);
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const errors: string[] = [];
  const supabase = createServerClient();
  const saisonCourante = new Date().getFullYear();
  console.log(`[cron] Démarrage check-deaths`);

  const finish = async (r: CronResult) => {
    console.log('[cron] Terminé :', r);
    await alertAdmin(r).catch(e => console.error('[cron] Alerte admin impossible:', e));
    return NextResponse.json(r);
  };

  // ── 1. Candidats vivants (tous, par tranches de 1 000) ───────────────────
  let vivants: CandidatVivant[];
  try {
    vivants = await fetchAllRows<CandidatVivant>((from, to) => supabase
      .from('candidats').select('id, nom, ddn, ddd, wikidata_id, photo')
      .is('ddd', null).not('wikidata_id', 'is', null).neq('wikidata_id', '')
      .order('id').range(from, to));
  } catch (err) {
    return finish({ checked: 0, deaths: 0, notifications_sent: 0, errors: [`Lecture des candidats : ${(err as Error).message}`] });
  }
  if (vivants.length === 0) return finish({ checked: 0, deaths: 0, notifications_sent: 0, errors });

  // ── 2. Wikidata ──────────────────────────────────────────────────────────
  const decesList: DecesDetecte[] = [];
  for (let i = 0; i < vivants.length; i += WIKIDATA_BATCH_SIZE) {
    const batch = vivants.slice(i, i + WIKIDATA_BATCH_SIZE);
    try {
      const resultMap = await checkBatchOnWikidata(batch.map(c => c.wikidata_id));
      for (const candidat of batch) {
        const ddd = resultMap.get(candidat.wikidata_id);
        if (!ddd) continue;
        if (ddd === 'illisible') {
          errors.push(`Décès de ${candidat.nom} (${candidat.wikidata_id}) sans date lisible sur Wikidata : à saisir à la main`);
          continue;
        }
        decesList.push({ candidat, ddd, saison: annee(ddd), gagnants: [], ancienParieurs: new Map() });
      }
    } catch (err: unknown) {
      const msg = `Erreur Wikidata lot ${i / WIKIDATA_BATCH_SIZE + 1}: ${err instanceof Error ? err.message : String(err)}`;
      console.error('[cron]', msg); errors.push(msg);
    }
    if (i + WIKIDATA_BATCH_SIZE < vivants.length) await sleep(DELAY_BETWEEN_BATCHES_MS);
  }
  if (decesList.length === 0) {
    return finish({ checked: vivants.length, deaths: 0, notifications_sent: 0, errors });
  }

  // ── 3. Maj DB pour tous les décès + repérage des anciens parieurs ────────
  const traites: DecesDetecte[] = [];
  for (const entry of decesList) {
    const { candidat, ddd, saison } = entry;

    const { error: uce } = await supabase.from('candidats').update({ ddd }).eq('id', candidat.id);
    if (uce) { errors.push(`Erreur update candidat ${candidat.nom} (${candidat.id}): ${uce.message}`); continue; }

    const { data: parisSaison, error: pe } = await supabase
      .from('paris').select('id, joueur, saison, created_at')
      .eq('candidat_id', candidat.id).eq('saison', saison);
    if (pe) { errors.push(`Erreur paris candidat ${candidat.id}: ${pe.message}`); continue; }

    const liste = parisSaison ?? [];
    entry.gagnants = liste.filter(p => pariGagnant(p, { ddd })).map(p => p.joueur as string);

    const aMarquer = liste.map(p => p.id);
    if (aMarquer.length > 0) {
      const { error: upe } = await supabase.from('paris').update({ mort: true }).in('id', aMarquer);
      if (upe) errors.push(`Erreur update paris candidat ${candidat.id}: ${upe.message}`);
    }

    // Anciens parieurs : joueurs ayant parié sur ce candidat une saison
    // antérieure, mais qui ne l'ont pas repris pour la saison du décès.
    const { data: historique, error: he } = await supabase
      .from('paris').select('joueur, saison')
      .eq('candidat_id', candidat.id).lt('saison', saison);
    if (he) {
      errors.push(`Erreur historique candidat ${candidat.id}: ${he.message}`);
    } else {
      const joueursSaison = new Set(liste.map(p => p.joueur as string));
      for (const row of historique ?? []) {
        if (joueursSaison.has(row.joueur)) continue;
        const years = entry.ancienParieurs.get(row.joueur) ?? [];
        if (!years.includes(row.saison)) years.push(row.saison);
        entry.ancienParieurs.set(row.joueur, years);
      }
    }
    traites.push(entry);
  }

  // ── 4. Classements des saisons touchées (en base, en une transaction) ────
  const rangs = new Map<number, Map<string, RankRow>>();
  for (const saison of new Set(traites.map(d => d.saison))) {
    const { error: rve } = await supabase.rpc('refresh_victoires', { p_saison: saison });
    if (rve) errors.push(`Erreur refresh_victoires ${saison}: ${rve.message}`);
    const { data: cl, error: cle } = await supabase.rpc('classement', { p_saison: saison });
    if (cle) errors.push(`Erreur classement ${saison}: ${cle.message}`);
    rangs.set(saison, new Map(((cl ?? []) as RankRow[]).map(r => [r.user_id, r])));
  }

  // ── 5. Emails ────────────────────────────────────────────────────────────
  let emailByUserId: Map<string, string>;
  let profiles: Profile[];
  try {
    emailByUserId = new Map((await listAllUsers(supabase)).map(u => [u.id, u.email ?? '']));
    profiles = await fetchAllRows<Profile>((from, to) => supabase
      .from('profiles').select('user_id, display_name, alert_mes_candidats, alert_autres_candidats')
      .order('user_id').range(from, to));
  } catch (err) {
    errors.push(`Lecture des joueurs : ${(err as Error).message}`);
    return finish({ checked: vivants.length, deaths: traites.length, notifications_sent: 0, errors });
  }
  const profileByUserId = new Map(profiles.map(p => [p.user_id, p]));

  const emailsToSend: EmailToSend[] = [];

  for (const { candidat, ddd, saison, gagnants, ancienParieurs } of traites) {
    const gagnantsSet = new Set(gagnants);
    const gainedPts = pointsPourAge(calculAge(candidat.ddn, ddd));
    const rangSaison = rangs.get(saison);
    const scorersNames = gagnants.map(id => profileByUserId.get(id)?.display_name ?? 'Joueur');

    for (const profile of profiles) {
      const userId = profile.user_id;
      const email = emailByUserId.get(userId);
      if (!email) continue;

      const isMine = gagnantsSet.has(userId);
      const anciennesSaisons = ancienParieurs.get(userId) ?? [];
      const isAncienParieur = !isMine && anciennesSaisons.length > 0;

      // L'ancien parieur est traité comme "mes candidats" (choix personnel passé).
      if ((isMine || isAncienParieur) && profile.alert_mes_candidats === false) continue;
      if (!isMine && !isAncienParieur && !profile.alert_autres_candidats) continue;

      const subject = isMine
        ? `+${gainedPts} point${gainedPts > 1 ? 's' : ''} — ${candidat.nom} est décédé(e)`
        : isAncienParieur
          ? `${candidat.nom} est décédé(e) — tu l'avais pourtant repéré(e)`
          : `${candidat.nom} est décédé(e)`;

      emailsToSend.push({
        to: email,
        subject,
        html: buildEmailHtml({
          displayName: profile.display_name ?? 'Joueur',
          candidat,
          ddd,
          saison,
          saisonCourante,
          isMine,
          isAncienParieur,
          anciennesSaisons,
          rank: rangSaison?.get(userId)?.rang ?? null,
          gainedPts,
          scorersNames: isMine || isAncienParieur
            ? []
            : scorersNames.filter(n => n !== profile.display_name),
        }),
      });
    }
  }

  const notificationsSent = await sendAllEmails(emailsToSend);
  return finish({ checked: vivants.length, deaths: traites.length, notifications_sent: notificationsSent, errors });
}
