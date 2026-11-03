import { describe, expect, it } from "vitest";
import { annee, aujourdhuiParis, calculAge, pariEnCours, pariGagnant, pointsPourAge } from "../lib/regles";

describe("calculAge", () => {
  it("compte les années révolues", () => {
    expect(calculAge("1950-06-15", "2026-06-14")).toBe(75);
    expect(calculAge("1950-06-15", "2026-06-15")).toBe(76);
  });
  it("gère les 29 février", () => {
    expect(calculAge("2000-02-29", "2026-02-28")).toBe(25);
    expect(calculAge("2000-02-29", "2026-03-01")).toBe(26);
  });
  it("renvoie null sans date de naissance", () => {
    expect(calculAge(null, "2026-01-01")).toBeNull();
  });
});

describe("pointsPourAge", () => {
  it.each([
    [0, 10], [54, 10], [55, 9], [64, 9], [65, 8], [74, 8], [75, 7], [79, 7],
    [80, 5], [84, 5], [85, 3], [89, 3], [90, 1], [110, 1],
  ])("%i ans → %i points", (age, pts) => {
    expect(pointsPourAge(age)).toBe(pts);
  });
  it("0 point si âge inconnu", () => {
    expect(pointsPourAge(null)).toBe(0);
  });
});

describe("pariGagnant", () => {
  const mort = { ddd: "2026-06-05" };
  it("compte un décès dans la saison du pari", () => {
    expect(pariGagnant({ saison: 2026 }, mort)).toBe(true);
  });
  it("ne compte pas un décès d'une autre saison", () => {
    expect(pariGagnant({ saison: 2025 }, mort)).toBe(false);
  });
  it("ne compte pas un candidat vivant", () => {
    expect(pariGagnant({ saison: 2026 }, { ddd: null })).toBe(false);
  });
  it("refuse un pari posé le jour du décès ou après", () => {
    expect(pariGagnant({ saison: 2026, created_at: "2026-06-05T08:00:00Z" }, mort)).toBe(false);
    expect(pariGagnant({ saison: 2026, created_at: "2026-06-07T08:00:00Z" }, mort)).toBe(false);
  });
  it("accepte un pari posé la veille (heure de Paris)", () => {
    expect(pariGagnant({ saison: 2026, created_at: "2026-06-04T21:00:00Z" }, mort)).toBe(true);
    // 22h30 UTC le 4 juin = 0h30 le 5 juin à Paris : trop tard
    expect(pariGagnant({ saison: 2026, created_at: "2026-06-04T22:30:00Z" }, mort)).toBe(false);
  });
  it("garde valables les paris historiques sans date", () => {
    expect(pariGagnant({ saison: 2026, created_at: null }, mort)).toBe(true);
  });
});

describe("pariEnCours", () => {
  it("vivant ou mort après la saison = en cours", () => {
    expect(pariEnCours({ saison: 2025 }, { ddd: null })).toBe(true);
    expect(pariEnCours({ saison: 2025 }, { ddd: "2026-01-02" })).toBe(true);
    expect(pariEnCours({ saison: 2026 }, { ddd: "2026-01-02" })).toBe(false);
  });
});

describe("dates", () => {
  it("lit l'année sans décalage de fuseau", () => {
    expect(annee("2027-01-01")).toBe(2027);
  });
  it("donne la date du jour à Paris", () => {
    expect(aujourdhuiParis(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });
});
