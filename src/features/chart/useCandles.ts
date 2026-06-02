import type { ExchangeCandle } from "@liq/sdk";
import { useLiqClient } from "@liq/react";
import { useEffect, useState } from "react";

type Interval = "1m" | "5m" | "15m" | "1h";

/**
 * Backfills [now-24h, now) via REST, then streams CLOSED 1m bars over SSE.
 * (5m/15m/1h have no stream — re-poll history each minute if you add them.)
 */
export function useCandles(
  marketId: bigint | undefined,
  interval: Interval = "1m",
) {
  const client = useLiqClient();
  const [candles, setCandles] = useState<ExchangeCandle[]>([]);

  useEffect(() => {
    if (marketId === undefined) return;
    let live = true;

    client.candles
      .history(marketId, {
        interval,
        from: new Date(Date.now() - 24 * 3600_000),
        to: new Date(),
      })
      .then((rows) => {
        // Reset and replace in the async callback to avoid synchronous setState in effect body
        if (live) setCandles(rows);
      })
      .catch(() => {
        /* surfaced by the chart's empty state */
      });

    if (interval !== "1m")
      return () => {
        live = false;
      };
    const unsub = client.candles.subscribe(marketId, (bar) => {
      setCandles((prev) => {
        const last = prev[prev.length - 1];
        if (last?.timestamp === bar.timestamp)
          return [...prev.slice(0, -1), bar];
        return [...prev, bar];
      });
    });
    return () => {
      live = false;
      unsub();
    };
  }, [client, marketId, interval]);

  return candles;
}
