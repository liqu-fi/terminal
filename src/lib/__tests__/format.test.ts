import { describe, expect, it } from "vitest";
import {
  fmtPrice,
  fmtQty,
  fmtSignedUsd,
  fmtUsd,
  fmtPctFromBps,
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
  it("fmtQty trims trailing zeros", () => {
    expect(fmtQty(WAD / 2n)).toBe("0.5");
    expect(fmtQty(4n * WAD)).toBe("4");
  });
  it("fmtPctFromBps treats 100 bps = 1%", () => {
    expect(fmtPctFromBps(250n)).toBe("2.50%");
    expect(fmtPctFromBps(-180n)).toBe("-1.80%");
  });
});
