// lib/deathCard.ts
//
// Source unique de vérité pour tout ce qui touche au calcul et à l'affichage
// d'un candidat décédé : formatage des dates, calcul de l'âge et des points,
// URL de la photo Wikimedia, taille du nom vertical.
// Utilisé par :
//   - app/api/cron/check-deaths/route.ts (calcul du classement, contenu email)
//   - app/api/og/card/route.tsx (génération de la carte-image)

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function calculAge(ddn: string | null, ddd: string | null): number | null {
  if (!ddn) return null;
  const birth = new Date(ddn);
  const ref = ddd ? new Date(ddd) : new Date();
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  return age;
}

// Barème de points selon l'âge au décès.
export function pointsPourAge(age: number | null): number {
  if (age === null) return 0;
  if (age < 55) return 10;
  if (age < 65) return 9;
  if (age < 75) return 8;
  if (age < 80) return 7;
  if (age < 85) return 5;
  if (age < 90) return 3;
  return 1;
}

// Construit l'URL de la photo à partir du nom de fichier Wikimedia Commons
// stocké en base (ex: "Philippe Bouvard 2018.jpg").
export function buildPhotoUrl(photo: string | null): string | null {
  if (!photo) return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(photo.replace(/ /g, '_'))}`;
}

// Reprend exactement les paliers de utils/fonctions.ts (formatNomCarte),
// convertis en px et doublés pour le rendu 2x de la carte-image (420x600
// pour un affichage 210x300). Les valeurs CSS de référence (.panini-card
// .pc-vname) sont en commentaire à côté de chaque palier.
export function cardNameStyle(nom: string): { fontSize: number; letterSpacing: string } {
  const len = nom.length;
  if (len <= 12) return { fontSize: 22.4, letterSpacing: '7px' }; // CSS: .7rem / 3.5px
  if (len <= 18) return { fontSize: 18.56, letterSpacing: '4px' }; // CSS: .58rem / 2px
  return { fontSize: 15.36, letterSpacing: '2px' }; // CSS: .48rem / 1px
}
