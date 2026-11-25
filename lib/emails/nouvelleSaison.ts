// lib/emails/nouvelleSaison.ts
//
// Email d'ouverture de saison : podium de la saison passée, mosaïque des
// personnalités mortes pendant l'année, invitation à remplir sa salle d'attente.
// Les vrais carrousels ne fonctionnent pas dans la plupart des messageries
// (Gmail, Outlook) : les cartes sont donc disposées en grille.

import { escapeHtml } from '@/lib/deathCard';

export interface MarcheDuPodium {
  rang: number;
  display_name: string;
  total_points: number;
  paris_gagnants: number;
}

export interface MortDeLAnnee {
  id: number;
  nom: string;
}

const CREME = '#f1ebdb';
const ROSE = '#db878f';
const OR = 'rgba(200,175,90,.9)';
const PAR_LIGNE = 3;

const s = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

function blocPodium(podium: MarcheDuPodium[], saisonPassee: number): string {
  if (podium.length === 0) {
    return `<p style="margin:0 0 28px;font-size:0.9rem;color:rgba(241,235,219,0.6);line-height:1.7;">
      ${saisonPassee} est terminée, et personne n'a marqué de point. Tout le monde repart à égalité.
    </p>`;
  }
  const medailles: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const lignes = podium.map(j => `
    <tr>
      <td width="36" style="padding:10px 0;font-size:1.3rem;vertical-align:middle;">${medailles[j.rang] ?? ''}</td>
      <td style="padding:10px 0;vertical-align:middle;">
        <span style="font-size:0.95rem;font-weight:700;color:${j.rang === 1 ? OR : CREME};">${escapeHtml(j.display_name)}</span>
      </td>
      <td align="right" style="padding:10px 0;vertical-align:middle;white-space:nowrap;">
        <span style="font-size:0.9rem;font-weight:700;color:${CREME};">${s(j.total_points, 'pt')}</span>
        <span style="display:block;font-size:0.65rem;color:rgba(241,235,219,0.35);">${s(j.paris_gagnants, 'pari gagnant')}</span>
      </td>
    </tr>`).join('');

  return `<p style="margin:0 0 10px;font-size:0.9rem;color:rgba(241,235,219,0.6);line-height:1.7;">
      ${saisonPassee} est terminée. Voici le podium :
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 32px;border-top:1px solid rgba(241,235,219,0.08);border-bottom:1px solid rgba(241,235,219,0.08);">
      ${lignes}
    </table>`;
}

function blocMorts(morts: MortDeLAnnee[], saisonPassee: number, url: string): string {
  if (morts.length === 0) return '';
  const cellules = morts.map(m => `
      <td width="33%" align="center" style="padding:6px;">
        <a href="${url}/candidat/${m.id}">
          <img src="${url}/api/og/card?id=${m.id}" width="120" height="171" alt="${escapeHtml(m.nom)}"
            style="display:block;width:120px;height:171px;border-radius:10px;border:0;">
        </a>
      </td>`);
  while (cellules.length % PAR_LIGNE !== 0) cellules.push('<td width="33%"></td>');
  const lignes: string[] = [];
  for (let i = 0; i < cellules.length; i += PAR_LIGNE) {
    lignes.push(`<tr>${cellules.slice(i, i + PAR_LIGNE).join('')}</tr>`);
  }

  return `<p style="margin:0 0 4px;font-size:0.72rem;font-weight:600;color:${ROSE};letter-spacing:2px;text-transform:uppercase;">
      Ils nous ont quittés en ${saisonPassee}
    </p>
    <p style="margin:0 0 14px;font-size:0.72rem;color:rgba(241,235,219,0.3);">${s(morts.length, 'personnalité')}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">${lignes.join('')}</table>
    <p style="margin:0 0 32px;text-align:center;font-size:0.75rem;">
      <a href="${url}/in-memoriam" style="color:rgba(241,235,219,0.45);">Voir l'In memoriam</a>
    </p>`;
}

export function mailNouvelleSaison(opts: {
  saison: number;
  podium: MarcheDuPodium[];
  morts: MortDeLAnnee[];
  url: string;
}): { subject: string; html: string } {
  const { saison, podium, morts, url } = opts;
  const saisonPassee = saison - 1;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0d0d18;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d18;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

        <tr><td style="background:rgba(241,235,219,0.04);border:1px solid rgba(241,235,219,0.08);border-radius:16px;padding:40px 30px;">
          <p style="margin:0 0 6px;font-size:1.4rem;font-weight:800;color:${CREME};letter-spacing:-0.4px;">
            Saison ${saison}<span style="color:${ROSE};">.</span>
          </p>
          <p style="margin:0 0 32px;font-size:0.72rem;font-weight:300;color:rgba(241,235,219,0.3);letter-spacing:1px;text-transform:uppercase;">
            Les compteurs sont à zéro
          </p>

          ${blocPodium(podium, saisonPassee)}
          ${blocMorts(morts, saisonPassee, url)}

          <p style="margin:0 0 18px;font-size:0.9rem;color:rgba(241,235,219,0.6);line-height:1.7;">
            Ta salle d'attente ${saison} est vide : tes paris de l'an dernier ne sont pas reconduits.
            Choisis jusqu'à <strong style="color:${CREME};">10 personnalités</strong>, des anciennes ou des nouvelles.
          </p>
          <p style="margin:0;font-size:0.9rem;color:rgba(241,235,219,0.6);line-height:1.7;">
            Plus ton candidat est jeune, plus il rapporte : jusqu'à <strong style="color:${CREME};">10 points</strong>.
            Et un pari ne compte que s'il est posé avant le décès. Ne traîne pas trop.
          </p>

          <table cellpadding="0" cellspacing="0" width="100%" style="margin-top:32px;"><tr><td align="center">
            <a href="${url}/salle-attente"
              style="display:inline-block;padding:14px 28px;background:${ROSE};color:#0d0d18;font-size:0.75rem;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;text-decoration:none;border-radius:10px;white-space:nowrap;">
              Remplir ma salle d'attente
            </a>
          </td></tr></table>

          <p style="margin:20px 0 0;text-align:center;font-size:0.75rem;">
            <a href="${url}/classement" style="color:rgba(241,235,219,0.45);">Voir le classement ${saisonPassee}</a>
          </p>
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

  return { subject: `La saison ${saison} est ouverte`, html };
}
