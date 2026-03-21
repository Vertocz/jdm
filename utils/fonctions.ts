// utils/fonctions.ts

export function formatFr(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR");
}

export function capitalizeFirst(text: string): string {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function calculAge(ddn: string | null, ddd: string | null): number | null {
  if (!ddn) return null;
  const naissance = new Date(ddn);
  const ref = ddd ? new Date(ddd) : new Date();
  let age = ref.getFullYear() - naissance.getFullYear();
  const passed =
    ref.getMonth() > naissance.getMonth() ||
    (ref.getMonth() === naissance.getMonth() && ref.getDate() >= naissance.getDate());
  if (!passed) age--;
  return age;
}

const scores = [
  { min: 0,   max: 55,   points: 10 },
  { min: 55,  max: 65,   points: 9  },
  { min: 65,  max: 75,   points: 8  },
  { min: 75,  max: 80,   points: 7  },
  { min: 80,  max: 85,   points: 5  },
  { min: 85,  max: 90,   points: 3  },
  { min: 90,  max: 2000, points: 1  },
] as const;

export function pointsPourAge(age: number | null): number {
  if (age === null) return 0;
  return scores.find((s) => age >= s.min && age < s.max)?.points ?? 0;
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