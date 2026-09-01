import { describe, expect, it } from "vitest";
import {
  fmtPrice,
  fmtQty,
  fmtSignedUsd,
  fmtUsd,
  fmtPctFromBps,
  parseWadLoose,
  toNum,
} from "../format";

const WAD = 10n ** 18n;

describe("format", () => {
  it("toNum converts 18-dec WAD bigint to a float", () => {
    expect(toNum(74000n * WAD)).toBe(74000);
    expect(toNum(WAD / 2n)).toBe(0.5);
  });
  it("fmtUsd renders 2dp with $ and thousands", () => {
    expect(fmtUsd(1240n * WAD + WAD / 2n)).toBe("$1,240.50");
  });
  it("fmtSignedUsd prefixes sign", () => {
    expect(fmtSignedUsd(135n * WAD)).toBe("+$135.00");
    expect(fmtSignedUsd(-22n * WAD)).toBe("-$22.00");
  });
  it("fmtPrice renders thousands, up to 2dp", () => {
    expect(fmtPrice(74210n * WAD)).toBe("74,210");
  });
  it("fmtQty trims trailing zeros from the fraction only", () => {
    expect(fmtQty(WAD / 2n)).toBe("0.5");
    expect(fmtQty(4n * WAD)).toBe("4");
    // 1.250 WAD -> "1.25": the trailing fractional zero is trimmed, the
    // integer part is untouched.
    expect(fmtQty(1250n * (WAD / 1000n))).toBe("1.25");
    expect(fmtQty(0n)).toBe("0");
  });
  it("fmtQty never eats trailing zeros in the integer part", () => {
    // The old regex `\.?0+$` stripped trailing zeros off the WHOLE string,
    // not just the fraction, so 10/100/1000 all rendered as "1".
    expect(fmtQty(10n * WAD)).toBe("10");
    expect(fmtQty(100n * WAD)).toBe("100");
    expect(fmtQty(1000n * WAD)).toBe("1000");
  });
  it("fmtPctFromBps treats 100 bps = 1%", () => {
    expect(fmtPctFromBps(250n)).toBe("2.50%");
    expect(fmtPctFromBps(-180n)).toBe("-1.80%");
  });

  describe("parseWadLoose", () => {
    it("parses a plain integer string", () => {
      expect(parseWadLoose("1000000000000000")).toBe(10n ** 15n);
      expect(parseWadLoose("-42")).toBe(-42n);
    });
    it("expands the gateway's scientific notation (the live crash)", () => {
      // $1000 and $1,000,000 in 18-dec WAD, as the gateway actually serializes
      // them — BigInt() throws on these, which crashed the open-orders table.
      expect(parseWadLoose("1e+21")).toBe(1000n * WAD);
      expect(parseWadLoose("1e+24")).toBe(1_000_000n * WAD);
      expect(fmtPrice(parseWadLoose("1e+21"))).toBe("1,000");
    });
    it("expands a fractional mantissa", () => {
      expect(parseWadLoose("1.5e+21")).toBe(1500n * WAD);
      expect(parseWadLoose("-2.25e+22")).toBe(-22500n * WAD);
    });
    it("truncates a sub-integer result toward zero rather than throwing", () => {
      expect(parseWadLoose("1.5e+1")).toBe(15n);
      expect(parseWadLoose("5e-3")).toBe(0n);
    });
    it("never throws on junk — falls back instead", () => {
      expect(parseWadLoose("")).toBe(0n);
      expect(parseWadLoose("not-a-number")).toBe(0n);
    });
  });
});
