import { useMarketsQuery } from "@liqcx/liq-react";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type MarketSummary = NonNullable<
  ReturnType<typeof useMarketsQuery>["data"]
>[number];

type MarketCtx = {
  markets: MarketSummary[];
  marketId: bigint | undefined;
  market: MarketSummary | undefined;
  setMarketId: (id: bigint) => void;
  /** memoized [marketId] for single-market array-param hooks */
  marketIds: bigint[];
  /** memoized list of all market ids (for cross-market positions) */
  allMarketIds: bigint[];
};

const Ctx = createContext<MarketCtx | null>(null);

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
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSelectedMarket(): MarketCtx {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useSelectedMarket must be used within MarketProvider");
  return ctx;
}
