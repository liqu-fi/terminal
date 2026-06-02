import { useAvailableMarginQuery, usePricesQuery } from "@liqcx/liq-react";

import { fmtPrice, fmtUsd, toNum } from "../../lib/format";
import { MarketSelect } from "./MarketSelect";
import { useFunding } from "./useFunding";
import { useSelectedMarket } from "./MarketContext";

export function MarketHeader() {
  const { marketId, marketIds } = useSelectedMarket();
  const { data: prices } = usePricesQuery(marketIds);
  const { data: funding } = useFunding(marketId);
  const { data: margins } = useAvailableMarginQuery();

  const info =
    marketId !== undefined ? prices?.[marketId.toString()] : undefined;
  const dirColor =
    info?.change === "up"
      ? "text-long"
      : info?.change === "down"
        ? "text-short"
        : "text-text";

  return (
    <div className="flex items-center gap-4">
      <MarketSelect />
      <span className={`text-sm font-bold ${dirColor}`}>
        {info ? `$${fmtPrice(info.price)}` : "—"}
        {info?.change === "up" ? " ▲" : info?.change === "down" ? " ▼" : ""}
      </span>
      <span className="text-xs text-muted">
        funding{" "}
        {/* NOTE: confirm funding rate scale (WAD per period) before relying on this number */}
        <span className="text-text">
          {funding ? `${(toNum(funding.rate) * 100).toFixed(4)}%` : "—"}
        </span>
      </span>
      <div className="flex-1" />
      <span className="text-xs text-muted">
        margin{" "}
        <span className="font-semibold text-text">
          {margins ? fmtUsd(margins.available) : "—"}
        </span>
      </span>
    </div>
  );
}
