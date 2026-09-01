import { Side } from "@liq/sdk";
import { useEnrichedPositions } from "@liq/react";

import { fmtPrice, fmtQty, fmtSignedUsd } from "../../lib/format";
import { useSelectedMarket } from "../market/useSelectedMarket";

export function PositionsTable() {
  const { markets, allMarketIds } = useSelectedMarket();
  const { data: positions = [], isLoading } =
    useEnrichedPositions(allMarketIds);

  if (isLoading)
    return <Empty testid="positions-loading">Loading positions…</Empty>;
  if (positions.length === 0)
    return <Empty testid="positions-empty">No open positions.</Empty>;

  const symbolOf = (id: bigint) =>
    markets.find((m) => m.id === id)?.symbol ?? id.toString();

  return (
    <table className="w-full text-sm" data-testid="positions-table">
      <thead>
        <tr className="text-left text-[11px] uppercase text-muted">
          <th className="py-1">Market</th>
          <th>Size</th>
          <th>Entry</th>
          <th>uPnL</th>
          <th>Liq.</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => {
          const long = p.side === Side.BUY;
          return (
            <tr
              key={p.marketId.toString()}
              className="border-t border-border"
              data-testid={`position-row-${p.marketId.toString()}`}
            >
              <td
                className={`py-1 font-semibold ${long ? "text-long" : "text-short"}`}
              >
                {symbolOf(p.marketId)} {long ? "↑" : "↓"}
              </td>
              <td>{fmtQty(p.size < 0n ? -p.size : p.size)}</td>
              <td>{fmtPrice(p.entryPrice)}</td>
              <td className={p.unrealizedPnl < 0n ? "text-short" : "text-long"}>
                {fmtSignedUsd(p.unrealizedPnl)}
              </td>
              <td>{fmtPrice(p.liquidationPrice)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Empty({
  children,
  testid,
}: {
  children: React.ReactNode;
  testid?: string;
}) {
  return (
    <div className="py-6 text-center text-sm text-muted" data-testid={testid}>
      {children}
    </div>
  );
}
