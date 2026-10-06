import { describe, expect, it } from "vitest";
import { MAX_AMOUNT_SATANG, formatBaht, formatSatang, parseBahtToSatang } from "./money";

describe("parseBahtToSatang", () => {
  it("converts whole baht and one or two decimals", () => {
    expect(parseBahtToSatang("125")).toBe(12_500);
    expect(parseBahtToSatang("125.5")).toBe(12_550);
    expect(parseBahtToSatang("125.05")).toBe(12_505);
    expect(parseBahtToSatang("0.01")).toBe(1);
  });

  it("accepts thousands commas and surrounding spaces", () => {
    expect(parseBahtToSatang(" 1,250.50 ")).toBe(125_050);
  });

  it("has no floating-point drift on the classic cases", () => {
    // 0.1 + 0.2 = 0.30000000000000004 and 1.005 * 100 = 100.49999999999999 in floats
    expect(parseBahtToSatang("0.30")).toBe(30);
    expect(parseBahtToSatang("1.01")).toBe(101);
    expect(parseBahtToSatang("19.99")).toBe(1_999);
    expect(parseBahtToSatang("4.35")).toBe(435);
  });

  it("rejects what is not a plain amount: nothing is guessed", () => {
    for (const bad of ["", "  ", "0", "0.00", "-5", "+5", "1.234", "1.", ".5", "abc", "12 บาท", "1e3", "1,2,3.00x", "NaN", "Infinity"]) {
      expect(parseBahtToSatang(bad)).toBeNull();
    }
  });

  it("rejects an amount the backend column cannot hold", () => {
    expect(parseBahtToSatang("21474836.47")).toBeNull();
    expect(parseBahtToSatang("20000000.00")).toBe(MAX_AMOUNT_SATANG);
    expect(parseBahtToSatang("20000000.01")).toBeNull();
  });
});

describe("formatSatang / formatBaht", () => {
  it("always shows two decimals", () => {
    expect(formatSatang(0)).toBe("0.00");
    expect(formatSatang(5)).toBe("0.05");
    expect(formatSatang(12_550)).toBe("125.50");
    expect(formatSatang(125_050_00)).toBe("125,050.00");
  });

  it("shows a negative balance with the sign in front of the sign of currency", () => {
    expect(formatSatang(-1_999)).toBe("-19.99");
    expect(formatBaht(-1_999)).toBe("-฿19.99");
    expect(formatBaht(12_550)).toBe("฿125.50");
  });

  it("round-trips: format then parse gives the same satang", () => {
    for (const satang of [1, 99, 100, 1_999, 125_050, 99_999_999, 2_000_000_000]) {
      expect(parseBahtToSatang(formatSatang(satang))).toBe(satang);
    }
  });
});
