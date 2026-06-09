import { describe, expect, it } from "vitest";

import { sanitizeDecimal } from "../decimal";

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
