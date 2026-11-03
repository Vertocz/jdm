// lib/deathCard.ts
//
// Affichage d'un candidat décédé : formatage des dates, URL de la photo
// Wikimedia, taille du nom vertical. Les règles de calcul (âge, points)
// viennent de lib/regles.ts.
// Utilisé par :
//   - app/api/cron/check-deaths/route.ts (contenu email)
//   - app/api/og/card/route.tsx (génération de la carte-image)

export { calculAge, pointsPourAge } from './regles';

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

// Construit l'URL de la photo à partir du nom de fichier Wikimedia Commons
// stocké en base (ex: "Philippe Bouvard 2018.jpg").
export function buildPhotoUrl(photo: string | null): string | null {
  if (!photo) return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(photo.replace(/ /g, '_'))}`;
}

// Taille du nom vertical sur la carte-image (420x600, rendu 2x d'une carte
// 210x300). Paliers propres à la carte-image : ils ne reprennent pas ceux de
// utils/fonctions.ts (formatNomCarte), la bande étant plus étroite.
export function cardNameStyle(nom: string): { fontSize: number; letterSpacing: string } {
  const len = nom.length;
  if (len <= 12) return { fontSize: 22.4, letterSpacing: '7px' };
  if (len <= 18) return { fontSize: 18.56, letterSpacing: '4px' };
  return { fontSize: 15.36, letterSpacing: '2px' };
}

// Échappe le texte inséré dans du HTML (emails).
export function escapeHtml(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
