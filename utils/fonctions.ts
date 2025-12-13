// --- Fonctions utilitaires ---

// Format français JJ/MM/AAAA
export function formatFr(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR");
}

// Calcul de l'âge (à la mort ou à la date actuelle selon le cas)
export function calculAge(ddn: string | null, ddd: string | null) {
  if (!ddn) return null;

  const naissance = new Date(ddn);

  // --- Cas décès : âge exact à la date du décès ---
  if (ddd) {
    const mort = new Date(ddd);
    let age = mort.getFullYear() - naissance.getFullYear();

    const anniversairePasse =
      mort.getMonth() > naissance.getMonth() ||
      (mort.getMonth() === naissance.getMonth() &&
        mort.getDate() >= naissance.getDate());

    if (!anniversairePasse) age--;

    return age;
  }

  // --- Cas vivant : âge aujourd'hui ---
  const today = new Date();
  let age = today.getFullYear() - naissance.getFullYear();

  const anniversairePasse =
    today.getMonth() > naissance.getMonth() ||
    (today.getMonth() === naissance.getMonth() &&
      today.getDate() >= naissance.getDate());

  if (!anniversairePasse) age--;

  return age;
}


// Barème des points
const scores = [
  { min: 0, max: 55, points: 10 },
  { min: 55, max: 65, points: 9 },
  { min: 65, max: 75, points: 8 },
  { min: 75, max: 80, points: 7 },
  { min: 80, max: 85, points: 5 },
  { min: 85, max: 90, points: 3 },
  { min: 90, max: 2000, points: 1 },
];

export function pointsPourAge(age: number | null) {
  if (age === null) return 0;
  const score = scores.find(s => age >= s.min && age < s.max);
  return score ? score.points : 0;
}