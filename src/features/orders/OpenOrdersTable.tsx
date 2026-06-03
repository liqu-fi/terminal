import { Side } from "@liq/sdk";
import {
  useAccountId,
  useCancelOrderMutation,
  useConditionalOrders,
  useOpenOrdersQuery,
} from "@liq/react";

import { fmtPrice, fmtQty } from "../../lib/format";
import { useSelectedMarket } from "../market/MarketContext";

export function OpenOrdersTable() {
  const { markets } = useSelectedMarket();
  const accountId = useAccountId();
  const { data: open = [] } = useOpenOrdersQuery(accountId);
  const { data: conditional = [] } = useConditionalOrders();
  const orders = [...open, ...conditional];
  const cancel = useCancelOrderMutation(accountId);

  if (orders.length === 0)
    return (
      <div
        className="py-6 text-center text-sm text-muted"
        data-testid="orders-empty"
      >
        No open orders.
      </div>
    );

  const symbolOf = (id: string) =>
    markets.find((m) => m.id.toString() === id)?.symbol ?? id;

  return (
    <table className="w-full text-sm" data-testid="orders-table">
      <thead>
        <tr className="text-left text-[11px] uppercase text-muted">
          <th className="py-1">Market</th>
          <th>Type</th>
          <th>Side</th>
          <th>Size</th>
          <th>Price</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => {
          const px = o.triggerPrice ?? o.limitPrice;
          return (
            <tr
              key={o.id}
              className="border-t border-border"
              data-testid={`order-row-${o.id}`}
            >
              <td className="py-1 font-semibold">{symbolOf(o.marketId)}</td>
              <td className="text-muted">{o.orderType}</td>
              <td className={o.side === Side.BUY ? "text-long" : "text-short"}>
                {o.side}
              </td>
              <td>
                {fmtQty(
                  BigInt(o.sizeDelta) < 0n
                    ? -BigInt(o.sizeDelta)
                    : BigInt(o.sizeDelta),
                )}
              </td>
              <td>{px && px !== "0" ? fmtPrice(BigInt(px)) : "—"}</td>
              <td className="text-muted">{o.status}</td>
              <td>
                <button
                  type="button"
                  className="text-[11px] text-short disabled:opacity-50"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate(o.id)}
                  data-testid={`cancel-order-${o.id}`}
                >
                  Cancel
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
