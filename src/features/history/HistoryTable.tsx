import { useAccountId, useTradesRestQuery } from "@liq/react";

import { fmtPrice, fmtQty } from "../../lib/format";

export function HistoryTable() {
  const accountId = useAccountId();
  const { data: trades = [] } = useTradesRestQuery({ accountId, limit: 50 });

  if (trades.length === 0)
    return (
      <div
        className="py-6 text-center text-sm text-muted"
        data-testid="history-empty"
      >
        No trades yet.
      </div>
    );

  return (
    <table className="w-full text-sm" data-testid="history-table">
      <thead>
        <tr className="text-left text-[11px] uppercase text-muted">
          <th className="py-1">Time</th>
          <th>Side</th>
          <th>Size</th>
          <th>Price</th>
        </tr>
      </thead>
      <tbody>
        {trades.map((t) => (
          <tr
            key={t.id}
            className="border-t border-border"
            data-testid={`trade-row-${t.id}`}
          >
            <td className="py-1 text-muted">
              {new Date(t.timestamp).toLocaleTimeString()}
            </td>
            <td className={t.side === "BUY" ? "text-long" : "text-short"}>
              {t.side}
            </td>
            <td>{fmtQty(t.size)}</td>
            <td>{fmtPrice(t.price)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
