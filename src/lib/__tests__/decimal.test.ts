import { describe, expect, it } from "vitest";

import { sanitizeDecimal, usdcToWad } from "../decimal";

describe("usdcToWad", () => {
  const WAD = 10n ** 18n;

  it("scales a whole-USDC 6-decimal balance to the 18-dec WAD domain", () => {
    // 100 USDC = 100_000000 (6 dec) -> 100 * 10^18 (wad)
    expect(usdcToWad(100_000000n)).toBe(100n * WAD);
  });

  it("maps zero to zero", () => {
    expect(usdcToWad(0n)).toBe(0n);
  });

  it("preserves sub-cent precision (1 micro-USDC -> 1e12 wad)", () => {
    // 1 (6 dec) = 0.000001 USDC -> 0.000001 * 10^18 = 10^12
    expect(usdcToWad(1n)).toBe(10n ** 12n);
  });

  it("round-trips against a human amount parsed at 18 dec", () => {
    // A wallet holding 250.5 USDC (6 dec) must compare equal to the same
    // human amount parsed in the 18-dec domain the deposit gate uses.
    const usdc6 = 250_500000n; // 250.5 USDC
    expect(usdcToWad(usdc6)).toBe(2505n * 10n ** 17n); // 250.5 * 10^18
  });
});

describe("sanitizeDecimal", () => {
  it("strips letters and other non-numeric characters", () => {
    expect(sanitizeDecimal("abc", 6)).toBe("");
    expect(sanitizeDecimal("1a2b3", 6)).toBe("123");
    expect(sanitizeDecimal("1,234.5", 6)).toBe("1234.5");
  });

  it("drops a leading sign (no negatives)", () => {
    expect(sanitizeDecimal("-5", 6)).toBe("5");
    expect(sanitizeDecimal("+5", 6)).toBe("5");
  });

  it("collapses extra dots into a single decimal point", () => {
    expect(sanitizeDecimal("1.2.3", 6)).toBe("1.23");
    expect(sanitizeDecimal("...5", 6)).toBe(".5");
  });

  it("caps the fraction at maxDecimals", () => {
    expect(sanitizeDecimal("12.3456", 2)).toBe("12.34");
    expect(sanitizeDecimal("12.3", 2)).toBe("12.3");
  });

  it("forbids a fraction entirely when maxDecimals is 0", () => {
    expect(sanitizeDecimal("12.5", 0)).toBe("12");
  });

  it("rejects scientific notation (the `e` is stripped)", () => {
    expect(sanitizeDecimal("1e3", 6)).toBe("13");
  });

  it("keeps an empty field empty", () => {
    expect(sanitizeDecimal("", 6)).toBe("");
  });
});
