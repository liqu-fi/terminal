import { useMarketChannel, useTradesRestQuery } from "@liq/react";
import type { ListTradesQuery, TradeEventData, TradeRow } from "@liq/sdk";
import { useState } from "react";

import { parseWadLoose } from "@/lib/format";

const TAPE_LIMIT = 50;

/**
 * One row of the public trade tape — a settled fill or a live tick,
 * normalized to a single shape.
 *
 * @remarks `key` is the REST row's `id` for a fill; a live tick has none
 * ({@link TradeEventData} reports no id), so its key is synthetic —
 * `live-{timestamp}-{price}`. `txHash` is `null` for every live row for the
 * same reason: the event never carries one, and printing an explorer link
 * anyway would assert a fact the event never reported. Maker/taker role is
 * absent from this shape entirely — the tape is the public feed, and role
 * only exists relative to one account's own history (see `HistoryTable`).
 */
export interface TapeRow {
  key: string;
  timestamp: number;
  price: bigint;
  size: bigint;
  side: "BUY" | "SELL";
  txHash: string | null;
}

function fromRestRow(row: TradeRow): TapeRow {
  return {
    key: row.id,
    timestamp: row.timestamp,
    price: row.price,
    size: row.size,
    side: row.side,
    txHash: row.txHash,
  };
}

function fromLiveEvent(data: TradeEventData): TapeRow {
  return {
    key: `live-${data.timestamp}-${data.price}`,
    timestamp: data.timestamp,
    price: parseWadLoose(data.price),
    size: parseWadLoose(data.size),
    side: data.side === "SELL" ? "SELL" : "BUY",
    txHash: null,
  };
}

/**
 * Live rows still worth showing: only events strictly newer than the
 * freshest REST row.
 *
 * @remarks There is no id to dedupe by — a live tick simply doesn't carry
 * one (see {@link TapeRow}). `useTradesRestQuery`'s page is stale for 15s;
 * live ticks about the same fills arrive well before that window elapses.
 * Once the next REST refetch catches up, a duplicate stops being newer than
 * its own now-present REST row and drops out on its own — no row is ever
 * compared against another for equality. An empty REST page (still loading,
 * or a market with no history yet) sets no boundary at all — every live row
 * passes rather than none.
 */
export function freshLiveRows(
  live: readonly TapeRow[],
  restRows: readonly TapeRow[],
): TapeRow[] {
  const boundary = restRows[0]?.timestamp ?? -Infinity;
  return live.filter((row) => row.timestamp > boundary);
}

export interface UseTradesTapeResult {
  rows: TapeRow[];
  isLoading: boolean;
}

/**
 * Market trade tape: the REST page from `useTradesRestQuery` plus a buffer
 * of live `trades:{marketId}` ticks layered on top, newest first.
 *
 * @remarks The live buffer is appended to by comparing `event` against the
 * previous render's value *during render*, not inside a `useEffect` — the
 * "adjusting state when a prop changes" pattern from the React docs (same
 * one `useBookTick` uses for its own reset). `react-hooks/set-state-in-effect`
 * forbids a synchronous `setState` inside an effect body precisely because it
 * costs an extra commit with stale state visible in between; doing the
 * comparison in the render body lets React fold the adjustment into the same
 * render instead. A market switch is handled by the caller mounting this hook
 * under `key={marketId}` — the freshest way to blank per-market state is to
 * let the whole component (and its `useState`) remount, not to chase the
 * change with more render-time comparisons.
 */
export function useTradesTape(
  marketId: bigint | null | undefined,
): UseTradesTapeResult {
  const filter: ListTradesQuery =
    marketId != null ? { marketId, limit: TAPE_LIMIT } : { limit: TAPE_LIMIT };
  const { data, isLoading } = useTradesRestQuery(filter);
  const restRows = (data?.rows ?? []).map(fromRestRow);

  const event = useMarketChannel(marketId, "trades");
  const [lastEvent, setLastEvent] = useState(event);
  const [live, setLive] = useState<TapeRow[]>([]);

  if (event !== lastEvent) {
    setLastEvent(event);
    if (event) {
      setLive((prev) =>
        [fromLiveEvent(event.data), ...prev].slice(0, TAPE_LIMIT),
      );
    }
  }

  const rows = [...freshLiveRows(live, restRows), ...restRows].slice(
    0,
    TAPE_LIMIT,
  );

  return { rows, isLoading };
}
