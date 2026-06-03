import { useSelectedMarket } from "./useSelectedMarket";

export function MarketSelect() {
  const { markets, marketId, setMarketId } = useSelectedMarket();
  return (
    <select
      className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1 text-sm font-semibold text-text"
      value={marketId?.toString() ?? ""}
      onChange={(e) => setMarketId(BigInt(e.target.value))}
      data-testid="market-select"
    >
      {markets.map((m) => (
        <option key={m.id.toString()} value={m.id.toString()}>
          {m.symbol}
        </option>
      ))}
    </select>
  );
}
