import { Side } from "@liq/sdk";
import {
  liqQueryKeys,
  useAccountId,
  useCancelOrderMutation,
  useConditionalOrders,
  useOpenOrdersQuery,
} from "@liq/react";
import { useQueryClient } from "@tanstack/react-query";

import { fmtPrice, fmtQty, parseWadLoose } from "../../lib/format";
import { useSelectedMarket } from "../market/useSelectedMarket";

export function OpenOrdersTable() {
  const { markets } = useSelectedMarket();
  const accountId = useAccountId();
  const queryClient = useQueryClient();
  const { data: open = [] } = useOpenOrdersQuery(accountId);
  const { data: conditional = [] } = useConditionalOrders();
  const orders = [...open, ...conditional];
  const cancel = useCancelOrderMutation(accountId);

  // The SDK's cancel mutation invalidates only the OPEN orders query, not the
  // conditional one (liqcx/monorepo — useCancelOrderMutation onSuccess), so a
  // cancelled trigger order lingers until the next 60s poll. Invalidate the
  // conditional query here too; the root fix belongs in @liq/react.
  const cancelOrder = (id: string) =>
    cancel.mutate(id, {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: liqQueryKeys.orders.conditional(accountId?.toString() ?? ""),
        }),
    });

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
          // The gateway emits large prices in scientific notation ("1e+21");
          // parseWadLoose tolerates it where a bare BigInt() would throw and
          // crash this render (no error boundary). See lib/format.ts.
          const px = o.triggerPrice ?? o.limitPrice;
          const size = parseWadLoose(o.sizeDelta);
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
              <td>{fmtQty(size < 0n ? -size : size)}</td>
              <td>{px && px !== "0" ? fmtPrice(parseWadLoose(px)) : "—"}</td>
              <td className="text-muted">{o.status}</td>
              <td>
                <button
                  type="button"
                  className="text-[11px] text-short disabled:opacity-50"
                  disabled={cancel.isPending}
                  onClick={() => cancelOrder(o.id)}
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
