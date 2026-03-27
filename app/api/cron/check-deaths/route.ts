// app/api/cron/check-deaths/route.ts
//
// Déclenché chaque nuit à 0h00 par Vercel Cron (vercel.json).
// Peut aussi être appelé manuellement : GET /api/cron/check-deaths

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServerClient';

const WIKIDATA_URL             = 'https://www.wikidata.org/w/api.php';
const WIKIDATA_BATCH_SIZE      = 50;
const WIKIDATA_TIMEOUT_MS      = 15_000;
const DELAY_BETWEEN_BATCHES_MS = 500;

// ─── Types ───────────────────────────────────────────────────────────────────

interface CandidatVivant {
  id: number; nom: string; ddn: string | null; ddd: string | null;
  wikidata_id: string; photo: string | null;
}
interface DecesDetecte { candidat: CandidatVivant; ddd: string; joueurIds: string[]; }
interface RankEntry    { userId: string; totalPoints: number; parisGagnants: number; moyenneAge: number; rank: number; }
interface CronResult   { checked: number; deaths: number; notifications_sent: number; errors: string[]; }

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function calculAge(ddn: string | null, ddd: string | null): number | null {
  if (!ddn) return null;
  const birth = new Date(ddn), ref = ddd ? new Date(ddd) : new Date();
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  return age;
}
// Doit rester identique à utils/fonctions.ts → scores[]
function pointsPourAge(age: number | null): number {
  if (age === null) return 0;
  if (age < 55) return 10;
  if (age < 65) return 9;
  if (age < 75) return 8;
  if (age < 80) return 7;
  if (age < 85) return 5;
  if (age < 90) return 3;
  return 1;
}
function formatNomCarte(nom: string): { display: string; fontSize: string; letterSpacing: string } {
  const len = nom.length;
  if (len <= 12) return { display: nom, fontSize: '.7rem',  letterSpacing: '3.5px' };
  if (len <= 18) return { display: nom, fontSize: '.58rem', letterSpacing: '2px'   };
  return              { display: nom, fontSize: '.48rem', letterSpacing: '1px'   };
}
function ordinal(n: number): string {
  if (n === 1) return '1er';
  return `${n}ème`;
}
function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(', ') + ' et ' + names[names.length - 1];
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
      const mCur  = s.wins > 0 ? s.totalAge / s.wins : 0;
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

// ─── Carte Panini inline ──────────────────────────────────────────────────────

function buildPaniniCardHtml(candidat: CandidatVivant, ddd: string): string {
  const age = calculAge(candidat.ddn, ddd);
  const pts = pointsPourAge(age);
  const serial = '#' + String(candidat.id).padStart(4, '0');
  const { display, fontSize, letterSpacing } = formatNomCarte(candidat.nom);
  const photoUrl = candidat.photo
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(candidat.photo.replace(/ /g, '_'))}`
    : null;

  return `
<table cellpadding="0" cellspacing="0" align="center" style="margin:28px auto 0;">
  <tr><td>
    <div style="width:210px;height:300px;border-radius:16px;position:relative;overflow:hidden;box-shadow:0 4px 28px rgba(0,0,0,.55),0 20px 60px rgba(0,0,0,.45);background:linear-gradient(150deg,#1a1810 0%,#12100a 55%,#0a0908 100%);display:inline-block;vertical-align:top;">
      <div style="position:absolute;inset:0;border-radius:16px;background:radial-gradient(ellipse 130% 70% at 40% -5%,rgba(160,140,60,.18) 0%,transparent 55%),radial-gradient(ellipse 70% 50% at 100% 105%,rgba(40,35,15,.5) 0%,transparent 50%);"></div>
      <div style="position:absolute;left:0;top:0;bottom:0;width:34px;border-radius:16px 0 0 16px;background:linear-gradient(180deg,rgba(160,140,90,.85) 0%,rgba(110,95,55,.75) 55%,rgba(60,50,25,.85) 100%);">
        <div style="position:absolute;top:0;bottom:0;left:0;right:0;display:flex;align-items:center;justify-content:center;">
          <span style="writing-mode:vertical-rl;transform:rotate(180deg);display:inline-block;font-family:Arial,sans-serif;font-weight:600;font-size:${fontSize};letter-spacing:${letterSpacing};color:rgba(255,255,255,.9);text-transform:uppercase;white-space:nowrap;overflow:hidden;max-height:220px;">${display}</span>
        </div>
        <div style="position:absolute;bottom:10px;left:0;width:34px;text-align:center;font-family:'Courier New',monospace;font-size:6px;color:rgba(255,255,255,.3);">${serial}</div>
      </div>
      <div style="position:absolute;left:34px;right:0;top:0;height:185px;border-radius:0 16px 0 0;overflow:hidden;">
        ${photoUrl
          ? `<img src="${photoUrl}" width="176" height="185" style="width:176px;height:185px;object-fit:cover;object-position:center top;display:block;filter:grayscale(1) brightness(.65);" alt="${candidat.nom}"/>`
          : `<div style="width:176px;height:185px;background:linear-gradient(160deg,#3d1f28 0%,#1e0f18 100%);text-align:center;line-height:185px;font-size:3.5rem;color:rgba(219,135,143,.1);">◆</div>`
        }
        <div style="position:absolute;bottom:0;left:0;right:0;height:80px;background:linear-gradient(to top,#141208,transparent);"></div>
      </div>
      <div style="position:absolute;right:11px;top:168px;width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#c8af5a 0%,#a08c3a 100%);box-shadow:0 3px 14px rgba(200,175,90,.4),0 0 0 2px rgba(255,255,255,.06);display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div style="font-family:Arial,sans-serif;font-size:16px;font-weight:800;color:white;line-height:1;">${pts}</div>
        <div style="font-family:Arial,sans-serif;font-size:6px;font-weight:500;color:rgba(255,255,255,.72);letter-spacing:1px;text-transform:uppercase;">${pts > 1 ? 'pts' : 'pt'}</div>
      </div>
      <div style="position:absolute;left:34px;right:0;bottom:0;padding:0 12px 13px 11px;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:top;"><div style="font-family:Arial,sans-serif;font-size:7px;color:rgba(219,135,143,.5);letter-spacing:1.5px;text-transform:uppercase;line-height:1;">Naissance</div><div style="font-family:Arial,sans-serif;font-size:11px;font-weight:500;color:rgba(241,235,219,.85);">${formatDate(candidat.ddn)}</div></td>
          <td style="vertical-align:top;padding:9px 7px 0;color:rgba(219,135,143,.3);font-size:9px;">→</td>
          <td style="vertical-align:top;"><div style="font-family:Arial,sans-serif;font-size:7px;color:rgba(219,135,143,.5);letter-spacing:1.5px;text-transform:uppercase;line-height:1;">Décès</div><div style="font-family:Arial,sans-serif;font-size:11px;font-weight:500;color:rgba(241,235,219,.85);">${formatDate(ddd)}</div></td>
        </tr></table>
        ${age !== null ? `<div style="font-family:Arial,sans-serif;font-size:9px;font-weight:300;color:rgba(200,175,90,.7);letter-spacing:1.5px;text-transform:uppercase;margin-top:3px;">${age} ans</div>` : ''}
      </div>
      <div style="position:absolute;inset:3px;border-radius:13px;border:1px solid rgba(200,175,90,.25);pointer-events:none;"></div>
    </div>
  </td></tr>
</table>`;
}

// ─── Email ────────────────────────────────────────────────────────────────────

function buildEmailHtml(opts: {
  displayName: string;
  candidat: CandidatVivant;
  ddd: string;
  isMine: boolean;
  rankEntry: RankEntry | null;
  gainedPts: number;
  scorersNames: string[];  // pseudos des joueurs ayant marqué (hors soi-même pour isMine)
}): string {
  const { displayName, candidat, ddd, isMine, rankEntry, gainedPts, scorersNames } = opts;

  let intro: string;
  if (isMine) {
    const ptsStr = `+${gainedPts} point${gainedPts > 1 ? 's' : ''}`;
    const rankStr = rankEntry ? `Tu es ${ordinal(rankEntry.rank)} du classement.` : '';
    intro = `${ptsStr} ! ${rankStr}`;
  } else {
    const who = joinNames(scorersNames);
    intro = `${who} ${scorersNames.length > 1 ? 'marquent des points' : 'marque des points'} avec <strong style="color:#f1ebdb;">${candidat.nom}</strong>.`;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://lejeudelamort.fr';

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0d0d18;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d18;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

        <tr><td align="center" style="padding-bottom:32px;">
          <p style="margin:0;font-size:1.6rem;font-weight:800;color:#f1ebdb;letter-spacing:-0.5px;line-height:1;">
            Le Jeu de la <span style="color:#db878f;">Mort.</span>
          </p>
        </td></tr>

        <tr><td style="background:rgba(241,235,219,0.04);border:1px solid rgba(241,235,219,0.08);border-radius:16px;padding:40px 36px;">
          <p style="margin:0 0 6px;font-size:1.4rem;font-weight:800;color:#f1ebdb;letter-spacing:-0.4px;">
            ${isMine ? `Ça y est<span style="color:#db878f;">.</span>` : `Info<span style="color:#db878f;">.</span>`}
          </p>
          <p style="margin:0 0 32px;font-size:0.72rem;font-weight:300;color:rgba(241,235,219,0.3);letter-spacing:1px;text-transform:uppercase;">
            Bonjour ${displayName}
          </p>
          <p style="margin:0 0 4px;font-size:0.9rem;color:rgba(241,235,219,0.6);line-height:1.7;">${intro}</p>

          ${buildPaniniCardHtml(candidat, ddd)}

          <table cellpadding="0" cellspacing="0" width="100%" style="margin-top:32px;"><tr><td align="center">
            <a href="${appUrl}/classement"
              style="display:inline-block;padding:14px 32px;background:#db878f;color:#0d0d18;font-size:0.75rem;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;text-decoration:none;border-radius:10px;">
              Voir le classement
            </a>
          </td></tr></table>
        </td></tr>

        <tr><td align="center" style="padding-top:24px;">
          <p style="margin:0;font-size:0.65rem;color:rgba(241,235,219,0.15);letter-spacing:0.5px;">
            Le Jeu de la Mort — de mauvais goût, et fier de l'être.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Resend ───────────────────────────────────────────────────────────────────

async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn('[cron] RESEND_API_KEY manquante — email non envoyé à', opts.to); return false; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Le Jeu de la Mort <noreply@news.lejeudelamort.fr>', to: opts.to, subject: opts.subject, html: opts.html }),
  });
  if (!res.ok) { console.error('[cron] Erreur Resend:', await res.text()); return false; }
  return true;
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
        if (ddd) { decesList.push({ candidat, ddd, joueurIds: [] }); }
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

  // ── 4. Maj DB pour tous les décès ────────────────────────────────────────
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
  }

  // ── 5. Calculer le classement une fois toutes les mises à jour faites ────
  const ranking = await computeRanking(supabase, saison);

  // ── 6. Envoyer les emails ────────────────────────────────────────────────
  let notificationsSent = 0;

  for (const { candidat, ddd, joueurIds } of decesList) {
    const joueurSet     = new Set(joueurIds);
    const gainedPts     = pointsPourAge(calculAge(candidat.ddn, ddd));
    const candidatAvecDdd = { ...candidat, ddd };

    // Pseudos des joueurs ayant marqué (pour l'email "info")
    const scorersNames = joueurIds
      .map(id => profileByUserId.get(id)?.display_name ?? 'Joueur')
      .filter(Boolean);

    for (const userId of allUserIds) {
      const profile = profileByUserId.get(userId);
      const email   = emailByUserId.get(userId);
      if (!profile || !email) continue;

      const isMine = joueurSet.has(userId);
      if (isMine  && !profile.alert_mes_candidats)   continue;
      if (!isMine && !profile.alert_autres_candidats) continue;

      const subject = isMine
        ? `+${gainedPts} point${gainedPts > 1 ? 's' : ''} — ${candidat.nom} est décédé(e)`
        : `${candidat.nom} est décédé(e)`;

      const html = buildEmailHtml({
        displayName:  profile.display_name ?? 'Joueur',
        candidat:     candidatAvecDdd,
        ddd,
        isMine,
        rankEntry:    ranking.get(userId) ?? null,
        gainedPts,
        scorersNames: isMine
          ? []
          : scorersNames.filter(n => n !== profile.display_name),
      });

      const sent = await sendEmail({ to: email, subject, html });
      if (sent) { notificationsSent++; console.log(`[cron] Email → ${email} (${candidat.nom}, isMine:${isMine})`); }
    }
  }

  const result: CronResult = { checked: vivants.length, deaths: decesList.length, notifications_sent: notificationsSent, errors };
  console.log('[cron] Terminé :', result);
  return NextResponse.json(result);
}