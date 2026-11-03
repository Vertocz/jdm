// utils/fonctions.ts

// Les règles de calcul vivent dans lib/regles.ts (source unique).
export { calculAge, pointsPourAge, pariGagnant, pariEnCours, annee } from "@/lib/regles";

/** "YYYY-MM-DD" → "JJ/MM/AAAA", sans passer par new Date() (décalage UTC). */
export function formatFr(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function capitalizeFirst(text: string): string {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Adapte le nom + la typo de la bande verticale.
 * "Andrew Mountbatten-Windsor" → "A. Mountbatten-Windsor"
 */
export function formatNomCarte(nom: string): {
  display: string;
  fontSize: string;
  letterSpacing: string;
} {
  const n = nom.length;
  if (n <= 16) return { display: nom, fontSize: "0.7rem",  letterSpacing: "3.5px" };
  if (n <= 22) return { display: nom, fontSize: "0.58rem", letterSpacing: "2px"   };
  if (n <= 28) return { display: nom, fontSize: "0.49rem", letterSpacing: "1px"   };

  const parts   = nom.trim().split(" ");
  const first   = parts.shift()!;
  const display = first[0] + ". " + parts.join(" ");
  const short   = display.length <= 22;
  return {
    display,
    fontSize:      short ? "0.58rem" : "0.49rem",
    letterSpacing: short ? "2px"     : "1px",
  };
}
