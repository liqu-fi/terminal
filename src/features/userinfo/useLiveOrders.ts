import {
  useAccountId,
  useOpenOrdersQuery,
  useSseOrderUpdates,
} from "@liq/react";
import { useMemo } from "react";

/** Keeps open orders / positions fresh by subscribing to their SSE channels. */
export function useLiveOrders() {
  const accountId = useAccountId();
  const { data: open = [] } = useOpenOrdersQuery(accountId);
  const orderIds = useMemo(() => open.map((o) => o.id), [open]);
  useSseOrderUpdates(orderIds);
}
