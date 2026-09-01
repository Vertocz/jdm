// app/api/cron/check-deaths/route.ts
//
// Déclenché chaque nuit à 0h00 par Vercel Cron (vercel.json).
// Peut aussi être appelé manuellement : GET /api/cron/check-deaths

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServerClient';
import { formatDate, calculAge, pointsPourAge, buildPhotoUrl } from '@/lib/deathCard';

const WIKIDATA_URL = 'https://www.wikidata.org/w/api.php';
const WIKIDATA_BATCH_SIZE = 50;
const WIKIDATA_TIMEOUT_MS = 15_000;
const DELAY_BETWEEN_BATCHES_MS = 500;

// Limite de l'API batch Resend (max 100 emails par appel) + marge de sécurité
// entre deux lots pour rester sous la limite de débit (10 req/s par défaut).
const RESEND_BATCH_SIZE = 100;
const DELAY_BETWEEN_RESEND_BATCHES_MS = 700;

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
  joueurIds: string[];
  // userId -> liste des années (saisons passées, hors année du décès) où ce
  // joueur avait parié sur ce candidat sans le re-parier cette année.
  ancienParieurs: Map<string, number[]>;
}
interface RankEntry { userId: string; totalPoints: number; parisGagnants: number; moyenneAge: number; rank: number; }
interface CronResult { checked: number; deaths: number; notifications_sent: number; errors: string[]; }
interface EmailToSend { to: string; subject: string; html: string; }

// ─── Sécurité ─────────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === 'development';
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

// ─── Wikidata ─────────────────────────────────────────────────────────────────

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), WIKIDATA_TIMEOUT_MS);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
}
async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function checkBatchOnWikidata(wikidataIds: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const res = await fetchWithTimeout(
    `${WIKIDATA_URL}?${new URLSearchParams({ action: 'wbgetentities', ids: wikidataIds.join('|'), props: 'claims', format: 'json' })}`
  );
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
  const entities = (await res.json()).entities ?? {};
  for (const id of wikidataIds) {
    const entity = entities[id];
    if (!entity || entity.missing !== undefined) { result.set(id, null); continue; }
    const p570 = entity.claims?.['P570'];
    if (!p570?.[0]) { result.set(id, null); continue; }
    try {
      const match = (p570[0].mainsnak.datavalue.value.time as string).match(/\+(\d{4})-(\d{2})-(\d{2})/);
      result.set(id, match ? `${match[1]}-${match[2]}-${match[3]}` : null);
    } catch { result.set(id, null); }
  }
  return result;
}

// ─── Helpers d'affichage propres à l'email (pas au candidat lui-même) ─────────

function ordinal(n: number): string {
  if (n === 1) return '1er';
  return `${n}ème`;
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

// ─── Classement ───────────────────────────────────────────────────────────────

async function computeRanking(
  supabase: ReturnType<typeof createServerClient>,
  saison: number
): Promise<Map<string, RankEntry>> {
  const { data: paris } = await supabase
    .from('paris')
    .select('joueur, candidats ( ddn, ddd )')
    .eq('saison', saison)
    .eq('mort', true);

  const scores = new Map<string, { points: number; wins: number; totalAge: number }>();
  for (const p of (paris ?? []) as any[]) {
    const c = p.candidats;
    if (!c?.ddd || new Date(c.ddd).getFullYear() !== saison) continue;
    const age = calculAge(c.ddn, c.ddd) ?? 0;
    const pts = pointsPourAge(age);
    const cur = scores.get(p.joueur) ?? { points: 0, wins: 0, totalAge: 0 };
    scores.set(p.joueur, { points: cur.points + pts, wins: cur.wins + 1, totalAge: cur.totalAge + age });
  }

  // Tri : points desc, puis paris gagnants desc, puis moyenne d'âge asc
  const sorted = Array.from(scores.entries()).sort(([, a], [, b]) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const mA = a.wins > 0 ? a.totalAge / a.wins : 0;
    const mB = b.wins > 0 ? b.totalAge / b.wins : 0;
    return mA - mB;
  });

  const ranking = new Map<string, RankEntry>();
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    const [userId, s] = sorted[i];
    if (i > 0) {
      const prev = sorted[i - 1][1];
      const mPrev = prev.wins > 0 ? prev.totalAge / prev.wins : 0;
      const mCur = s.wins > 0 ? s.totalAge / s.wins : 0;
      if (s.points !== prev.points || s.wins !== prev.wins || mCur !== mPrev) rank = i + 1;
    }
    const moyenneAge = s.wins > 0 ? s.totalAge / s.wins : 0;
    ranking.set(userId, { userId, totalPoints: s.points, parisGagnants: s.wins, moyenneAge, rank });
  }

  // Mettre à jour la table victoires pour cette saison
  if (sorted.length > 0) {
    const rows = Array.from(ranking.values()).map(r => ({
      joueur_id: r.userId,
      saison,
      rang: r.rank,
    }));
    // Supprimer les anciens rangs de cette saison puis réinsérer
    await supabase.from('victoires').delete().eq('saison', saison);
    await supabase.from('victoires').insert(rows);
  }

  return ranking;
}

// ─── Carte candidat : image générée par app/api/og/card ───────────────────────

function buildCardImageUrl(appUrl: string, candidat: CandidatVivant, ddd: string): string {
  const params = new URLSearchParams({ id: String(candidat.id), nom: candidat.nom, ddd });
  if (candidat.ddn) params.set('ddn', candidat.ddn);
  if (candidat.photo) params.set('photo', candidat.photo);
  return `${appUrl}/api/og/card?${params.toString()}`;
}

// ─── Email ────────────────────────────────────────────────────────────────────

function buildEmailHtml(opts: {
  displayName: string;
  candidat: CandidatVivant;
  ddd: string;
  isMine: boolean;
  isAncienParieur: boolean;
  anciennesSaisons: number[];
  rankEntry: RankEntry | null;
  gainedPts: number;
  scorersNames: string[]; // pseudos des joueurs ayant marqué cette année (hors soi-même pour isMine)
}): string {
  const { displayName, candidat, ddd, isMine, isAncienParieur, anciennesSaisons, rankEntry, gainedPts, scorersNames } = opts;

  const age = calculAge(candidat.ddn, ddd);

  let intro: string;
  if (isMine) {
    const ptsStr = `+${gainedPts} point${gainedPts > 1 ? 's' : ''}`;
    const rankStr = rankEntry ? `Tu es ${ordinal(rankEntry.rank)} du classement.` : '';
    intro = `${ptsStr} ! ${rankStr}`;
  } else if (isAncienParieur) {
    const ageStr = age !== null ? ` à ${age} ans` : '';
    intro = `Tu avais repéré <strong style="color:#f1ebdb;">${candidat.nom}</strong> ${joinYears(anciennesSaisons)}. Fallait persévérer ça t'aurait rapporté ${gainedPts} point${gainedPts > 1 ? 's' : ''}.`;
  } else if (scorersNames.length > 0) {
    const who = joinNames(scorersNames);
    intro = `${who} ${scorersNames.length > 1 ? 'marquent des points' : 'marque des points'} avec <strong style="color:#f1ebdb;">${candidat.nom}</strong>.`;
  } else {
    intro = `<strong style="color:#f1ebdb;">${candidat.nom}</strong> nous a quitté(e).`;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://lejeudelamort.fr';
  const cardImageUrl = buildCardImageUrl(appUrl, candidat, ddd);

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

          <img src="${cardImageUrl}" width="210" height="300" alt="${candidat.nom}"
            style="display:block;margin:28px auto 0;width:210px;height:300px;border-radius:16px;">

          <table cellpadding="0" cellspacing="0" width="100%" style="margin-top:32px;"><tr><td align="center">
            <a href="${appUrl}/classement"
              style="display:inline-block;padding:14px 32px;background:#db878f;color:#0d0d18;font-size:0.75rem;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;text-decoration:none;border-radius:10px;white-space:nowrap;">
              Voir le classement
            </a>
          </td></tr></table>
        </td></tr>

        <tr><td align="center" style="padding-top:24px;">
          <p style="margin:0;font-size:0.65rem;color:rgba(241,235,219,0.15);letter-spacing:0.5px;">
            Le Jeu de la Mort
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
    from: 'Le Jeu de la Mort <noreply@news.lejeudelamort.fr>',
    to: e.to,
    subject: e.subject,
    html: e.html,
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
    const chunk = emails.slice(i, i + RESEND_BATCH_SIZE);
    sent += await sendEmailBatch(chunk);
    if (i + RESEND_BATCH_SIZE < emails.length) await sleep(DELAY_BETWEEN_RESEND_BATCHES_MS);
  }
  return sent;
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const errors: string[] = [];
  const supabase = createServerClient();
  const saison = new Date().getFullYear();
  console.log(`[cron] Démarrage check-deaths — saison ${saison}`);

  // ── 1. Candidats vivants ─────────────────────────────────────────────────
  const { data: candidatsVivants, error: fetchError } = await supabase
    .from('candidats').select('id, nom, ddn, ddd, wikidata_id, photo')
    .is('ddd', null).not('wikidata_id', 'is', null).neq('wikidata_id', '');
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const vivants: CandidatVivant[] = candidatsVivants ?? [];
  if (vivants.length === 0) return NextResponse.json({ checked: 0, deaths: 0, notifications_sent: 0, errors: [] });

  // ── 2. Wikidata ──────────────────────────────────────────────────────────
  const decesList: DecesDetecte[] = [];
  for (let i = 0; i < vivants.length; i += WIKIDATA_BATCH_SIZE) {
    const batch = vivants.slice(i, i + WIKIDATA_BATCH_SIZE);
    try {
      const resultMap = await checkBatchOnWikidata(batch.map(c => c.wikidata_id));
      for (const candidat of batch) {
        const ddd = resultMap.get(candidat.wikidata_id);
        if (ddd) { decesList.push({ candidat, ddd, joueurIds: [], ancienParieurs: new Map() }); }
      }
    } catch (err: unknown) {
      const msg = `Erreur Wikidata lot ${i / WIKIDATA_BATCH_SIZE + 1}: ${err instanceof Error ? err.message : String(err)}`;
      console.error('[cron]', msg); errors.push(msg);
    }
    if (i + WIKIDATA_BATCH_SIZE < vivants.length) await sleep(DELAY_BETWEEN_BATCHES_MS);
  }
  if (decesList.length === 0) return NextResponse.json({ checked: vivants.length, deaths: 0, notifications_sent: 0, errors });

  // ── 3. Charger profils + emails ──────────────────────────────────────────
  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const emailByUserId = new Map<string, string>(
    (usersData?.users ?? []).map((u: { id: string; email?: string }) => [u.id, u.email ?? ''])
  );
  const { data: profiles } = await supabase
    .from('profiles').select('user_id, display_name, alert_mes_candidats, alert_autres_candidats');
  const profileByUserId = new Map(
    (profiles ?? []).map((p: { user_id: string; display_name: string; alert_mes_candidats: boolean; alert_autres_candidats: boolean }) => [p.user_id, p])
  );
  const allUserIds = Array.from(profileByUserId.keys());

  // ── 4. Maj DB pour tous les décès + repérage des anciens parieurs ────────
  for (const entry of decesList) {
    const { candidat, ddd } = entry;

    const { error: uce } = await supabase.from('candidats').update({ ddd }).eq('id', candidat.id);
    if (uce) { errors.push(`Erreur update candidat ${candidat.id}: ${uce.message}`); continue; }

    const { data: parisActifs, error: pe } = await supabase
      .from('paris').select('id, joueur')
      .eq('candidat_id', candidat.id).eq('saison', saison).eq('mort', false);
    if (pe) { errors.push(`Erreur paris candidat ${candidat.id}: ${pe.message}`); continue; }

    const parisActifsList = parisActifs ?? [];
    entry.joueurIds = parisActifsList.map((p: any) => p.joueur);
    const pariIds = parisActifsList.map((p: any) => p.id);

    if (pariIds.length > 0) {
      const { error: upe } = await supabase.from('paris').update({ mort: true }).in('id', pariIds);
      if (upe) errors.push(`Erreur update paris candidat ${candidat.id}: ${upe.message}`);
    }

    // Anciens parieurs : joueurs ayant parié sur ce candidat une saison
    // antérieure, mais qui ne l'ont pas repris cette année.
    const { data: historique, error: he } = await supabase
      .from('paris').select('joueur, saison')
      .eq('candidat_id', candidat.id).lt('saison', saison);
    if (he) {
      errors.push(`Erreur historique candidat ${candidat.id}: ${he.message}`);
    } else {
      const joueurSetActuel = new Set(entry.joueurIds);
      for (const row of (historique ?? []) as any[]) {
        if (joueurSetActuel.has(row.joueur)) continue; // a re-parié cette année, pas de taquinerie
        const years = entry.ancienParieurs.get(row.joueur) ?? [];
        if (!years.includes(row.saison)) years.push(row.saison);
        entry.ancienParieurs.set(row.joueur, years);
      }
    }
  }

  // ── 5. Calculer le classement une fois toutes les mises à jour faites ────
  const ranking = await computeRanking(supabase, saison);

  // ── 6. Construire puis envoyer les emails (par lots, cf. sendAllEmails) ──
  const emailsToSend: EmailToSend[] = [];

  for (const { candidat, ddd, joueurIds, ancienParieurs } of decesList) {
    const joueurSet = new Set(joueurIds);
    const gainedPts = pointsPourAge(calculAge(candidat.ddn, ddd));
    const candidatAvecDdd = { ...candidat, ddd };

    // Pseudos des joueurs ayant marqué cette année (pour l'email "info")
    const scorersNames = joueurIds
      .map(id => profileByUserId.get(id)?.display_name ?? 'Joueur')
      .filter(Boolean);

    for (const userId of allUserIds) {
      const profile = profileByUserId.get(userId);
      const email = emailByUserId.get(userId);
      if (!profile || !email) continue;

      const isMine = joueurSet.has(userId);
      const anciennesSaisons = ancienParieurs.get(userId) ?? [];
      const isAncienParieur = !isMine && anciennesSaisons.length > 0;

      // L'ancien parieur est traité comme "mes candidats" (c'est un choix
      // personnel passé) plutôt que "autres candidats".
      if ((isMine || isAncienParieur) && !profile.alert_mes_candidats) continue;
      if (!isMine && !isAncienParieur && !profile.alert_autres_candidats) continue;

      const subject = isMine
        ? `+${gainedPts} point${gainedPts > 1 ? 's' : ''} — ${candidat.nom} est décédé(e)`
        : isAncienParieur
          ? `${candidat.nom} est décédé(e) — tu l'avais pourtant repéré(e)`
          : `${candidat.nom} est décédé(e)`;

      const html = buildEmailHtml({
        displayName: profile.display_name ?? 'Joueur',
        candidat: candidatAvecDdd,
        ddd,
        isMine,
        isAncienParieur,
        anciennesSaisons,
        rankEntry: ranking.get(userId) ?? null,
        gainedPts,
        scorersNames: isMine || isAncienParieur
          ? []
          : scorersNames.filter(n => n !== profile.display_name),
      });

      emailsToSend.push({ to: email, subject, html });
    }
  }

  const notificationsSent = await sendAllEmails(emailsToSend);

  const result: CronResult = { checked: vivants.length, deaths: decesList.length, notifications_sent: notificationsSent, errors };
  console.log('[cron] Terminé :', result);
  return NextResponse.json(result);
}
