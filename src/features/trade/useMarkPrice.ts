import { usePricesQuery } from "@liq/react";

import { useSelectedMarket } from "../market/MarketContext";

/** Mark price (Price, 18-dec bigint) for the selected market, or 0n while loading. */
export function useMarkPrice(): bigint {
  const { marketId, marketIds } = useSelectedMarket();
  const { data: prices } = usePricesQuery(marketIds);
  const info =
    marketId !== undefined ? prices?.[marketId.toString()] : undefined;
  return info?.price ?? 0n;
}
