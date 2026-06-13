import { useMarketsQuery } from "@liq/react";
import { useMemo, useState, type ReactNode } from "react";

import {
  type MarketCtx,
  SelectedMarketContext,
} from "./useSelectedMarket";

export function MarketProvider({ children }: { children: ReactNode }) {
  const { data: markets = [] } = useMarketsQuery();
  const [selected, setSelected] = useState<bigint | undefined>(undefined);

  const marketId = selected ?? markets[0]?.id;
  const market = markets.find((m) => m.id === marketId);
  const marketIds = useMemo(
    () => (marketId !== undefined ? [marketId] : []),
    [marketId],
  );
  const allMarketIds = useMemo(() => markets.map((m) => m.id), [markets]);

  const value: MarketCtx = {
    markets,
    marketId,
    market,
    setMarketId: setSelected,
    marketIds,
    allMarketIds,
  };
  return (
    <SelectedMarketContext.Provider value={value}>
      {children}
    </SelectedMarketContext.Provider>
  );
}
