import {
  Margin,
  type OrderVerdict,
  pctToSize,
  Price,
  Qty,
  Side,
  sizeFromLeverage,
  sizeToPct,
  sizeToUsd,
  Usd,
  usdToSize,
  validateOrder,
} from "@liq/sdk";
import { useMarketsFullRestQuery } from "@liq/react";
import { useState } from "react";

import { parseWadLoose, wadToFixed } from "../../lib/format";
import type { MarketSummary } from "../market/useSelectedMarket";
import { ticketSummary, type TicketSummary } from "./ticketSummary";

const WAD = 10n ** 18n;
const BPS = 10_000n;

export type SizeUnit = "base" | "usd";

export type OrderSizing = {
  sizeStr: string;
  setSizeStr: (v: string) => void;
  unit: SizeUnit;
  setUnit: (u: SizeUnit) => void;
  leverage: number;
  setLeverage: (l: number) => void;
  /** Set size from a 0–100% slice of buying power (slider / chips). */
  setPct: (p: number) => void;
  /** Shortcut for `setPct(100)` — the Max button. */
  setMax: () => void;
  reset: () => void;
  // derived
  sizeQty: bigint; // magnitude, 18-dec base units
  sizeDelta: bigint; // signed by side
  pct: number; // 0–100 slice of buying power (what the control requested)
  maxSize: bigint; // buying-power ceiling, base units
  notional: bigint; // Usd, 18-dec
  margin: bigint; // margin cost, 18-dec
  liqPrice: bigint | null; // estimated draft liquidation price, or null
  /** Обе стороны разом — тикет по макету показывает их рядом. */
  summary: TicketSummary;
  baseSymbol: string;
  baseDecimals: number;
  validation: OrderVerdict;
};

function fracDigits(s: string): number {
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
}

/** Parse the size field (in its active unit) to a magnitude in base units. */
function parseSizeInput(
  sizeStr: string,
  unit: SizeUnit,
  markPrice: bigint,
): bigint {
  if (!sizeStr) return 0n;
  try {
    if (unit === "base") return Qty.parse(sizeStr);
    return markPrice > 0n
      ? usdToSize(Usd.parse(sizeStr), Price(markPrice))
      : 0n;
  } catch {
    return 0n;
  }
}

/**
 * Interlinked order-sizing state for the trade ticket.
 *
 * Two pieces of state: the size string (in the active {@link SizeUnit} — the
 * authoritative order quantity) and `pct` (the slice of buying power the user
 * last requested via the slider/chips/Max — the authoritative slider position).
 * They are reconciled at every setter: typing a size re-derives `pct`; choosing
 * a `pct` rewrites the size; changing leverage rescales the size to preserve
 * `pct` against the new buying-power ceiling. Leverage never *fills* an empty
 * size — it only scales the ceiling and the margin/liq math.
 */
export function useOrderSizing(params: {
  market: MarketSummary | undefined;
  available: bigint;
  markPrice: bigint;
  side: Side;
}): OrderSizing {
  const { market, available, markPrice, side } = params;

  const [sizeStr, setSizeStrRaw] = useState("");
  const [unit, setUnitRaw] = useState<SizeUnit>("base");
  const [leverage, setLeverageRaw] = useState(2);
  const [pct, setPctRaw] = useState(0);

  // `useMarketsQuery` returns the gateway `/markets` payload unmapped, so
  // `minSize` arrives as a STRING at runtime despite its bigint type — coerce
  // before any bigint math (mixing throws "Cannot mix BigInt"). `parseWadLoose`
  // never throws and tolerates the scientific notation the gateway can emit.
  const minSize =
    market?.minSize != null ? parseWadLoose(String(market.minSize)) : 0n;
  const maxLeverage = market?.maxLeverage ?? 25;
  const baseSymbol = market?.symbol?.split(/[-/]/)[0]?.toUpperCase() ?? "";
  const minSizeDigits = minSize > 0n ? fracDigits(Qty.fmt(Qty(minSize))) : 4;
  const baseDecimals = Math.min(8, Math.max(2, minSizeDigits || 4));

  // Maintenance-margin fraction (WAD) for the liq-price estimate; best-effort.
  // `maintenanceMarginBps` is absent from leaner market payloads — guard so the
  // estimate stays optional rather than throwing on `undefined`.
  const { data: fullMarkets } = useMarketsFullRestQuery();
  const fullRow = fullMarkets?.find((m) => m.id === market?.id);
  const mmfWad =
    typeof fullRow?.maintenanceMarginBps === "bigint"
      ? (fullRow.maintenanceMarginBps * WAD) / BPS
      : undefined;

  const sizeQty = parseSizeInput(sizeStr, unit, markPrice);
  const maxSize = sizeFromLeverage({
    availableUsd: Usd(available),
    leverage,
    markPrice: Price(markPrice),
  });
  const summary = ticketSummary({
    sizeQty: Qty(sizeQty),
    markPrice: Price(markPrice),
    leverage,
    mmfWad,
  });
  const notional = summary.value;
  const margin = summary.cost;
  const taken = side === Side.BUY ? summary.long : summary.short;
  const validation = validateOrder({
    markPrice,
    sizeQty: Qty(sizeQty),
    minSize: Qty(minSize),
    leverage,
    maxLeverage,
    available: Margin(available),
    marginCost: margin,
  });

  function fmtForUnit(sizeWad: bigint, u: SizeUnit): string {
    if (sizeWad <= 0n) return "";
    return u === "base"
      ? wadToFixed(sizeWad, baseDecimals)
      : markPrice > 0n
        ? wadToFixed(sizeToUsd(Qty(sizeWad), Price(markPrice)), 2)
        : "";
  }

  // Typed size is authoritative; re-derive the slider position from it.
  function setSizeStr(v: string) {
    setSizeStrRaw(v);
    setPctRaw(sizeToPct(Qty(parseSizeInput(v, unit, markPrice)), maxSize));
  }

  // Chosen percentage is authoritative; rewrite the size to match.
  function setPct(p: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(p)));
    setPctRaw(clamped);
    setSizeStrRaw(fmtForUnit(pctToSize(clamped, maxSize), unit));
  }

  function setLeverage(l: number) {
    setLeverageRaw(l);
    // Preserve the requested slice against the new ceiling — but never fill an
    // empty size (decoupled: bumping leverage with no size leaves it empty).
    if (sizeStr) {
      const nextMax = sizeFromLeverage({
        availableUsd: Usd(available),
        leverage: l,
        markPrice: Price(markPrice),
      });
      setSizeStrRaw(fmtForUnit(pctToSize(pct, nextMax), unit));
    }
  }

  function setUnit(next: SizeUnit) {
    if (next === unit) return;
    // Without a mark price there is no base⇄USD conversion — switching would
    // format to "" and silently drop the typed size. No-op until price loads.
    if (markPrice <= 0n) return;
    setSizeStrRaw(fmtForUnit(sizeQty, next));
    setUnitRaw(next);
  }

  return {
    sizeStr,
    setSizeStr,
    unit,
    setUnit,
    leverage,
    setLeverage,
    setPct,
    setMax: () => setPct(100),
    reset: () => {
      setSizeStrRaw("");
      setPctRaw(0);
    },
    sizeQty,
    sizeDelta: taken.sizeDelta,
    pct,
    maxSize,
    notional,
    margin,
    liqPrice: taken.liqPrice,
    summary,
    baseSymbol,
    baseDecimals,
    validation,
  };
}
