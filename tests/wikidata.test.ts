import { describe, expect, it } from "vitest";
import { bestClaimValue, entityToPersonne, parseWikidataDate } from "../lib/wikidata";
import { escapeHtml } from "../lib/deathCard";

describe("parseWikidataDate", () => {
  it("lit une date au jour près", () => {
    expect(parseWikidataDate({ time: "+1929-12-06T00:00:00Z", precision: 11 })).toBe("1929-12-06");
  });
  it("remplace le jour inconnu par 01", () => {
    expect(parseWikidataDate({ time: "+2026-08-00T00:00:00Z", precision: 10 })).toBe("2026-08-01");
  });
  it("remplace le mois et le jour inconnus par 01", () => {
    expect(parseWikidataDate({ time: "+1964-00-00T00:00:00Z", precision: 9 })).toBe("1964-01-01");
  });
  it("corrige un 00 même si la précision annonce le jour", () => {
    expect(parseWikidataDate({ time: "+1964-03-00T00:00:00Z", precision: 11 })).toBe("1964-03-01");
  });
  it("ignore les dates trop imprécises ou absentes", () => {
    expect(parseWikidataDate({ time: "+1960-00-00T00:00:00Z", precision: 8 })).toBeNull();
    expect(parseWikidataDate(undefined)).toBeNull();
  });
});

describe("bestClaimValue", () => {
  const claims = {
    P570: [
      { rank: "deprecated", mainsnak: { datavalue: { value: "faux" } } },
      { rank: "normal", mainsnak: { datavalue: { value: "normal" } } },
      { rank: "preferred", mainsnak: { datavalue: { value: "prefere" } } },
    ],
  };
  it("préfère le rang preferred", () => {
    expect(bestClaimValue(claims, "P570")).toBe("prefere");
  });
  it("ignore les déclarations dépréciées", () => {
    expect(bestClaimValue({ P570: [claims.P570[0]] }, "P570")).toBeUndefined();
  });
});

describe("entityToPersonne", () => {
  it("repère un décès même sans date lisible", () => {
    const p = entityToPersonne("Q1", {
      labels: { fr: { value: "X" } },
      claims: {
        P569: [{ rank: "normal", mainsnak: { datavalue: { value: { time: "+1930-01-30T00:00:00Z", precision: 11 } } } }],
        P570: [{ rank: "normal", mainsnak: {} }],
      },
    });
    expect(p.estPersonne).toBe(true);
    expect(p.decede).toBe(true);
    expect(p.ddd).toBeNull();
  });
});

describe("escapeHtml", () => {
  it("neutralise les balises", () => {
    expect(escapeHtml('<a href="x">Réclame</a>')).toBe("&lt;a href=&quot;x&quot;&gt;Réclame&lt;/a&gt;");
  });
});
