import type { MarketFullRow } from "@liq/api-client";
import { useMarketsFullRestQuery } from "@liq/react";
import { useMemo } from "react";

import { useTerminalUiStore } from "@/stores/useTerminalUiStore";

export interface MarketRow {
  id: bigint;
  symbol: string;
  /** Плечо из начальной маржи; `null` — маржа неизвестна или нулевая. */
  maxLeverage: number | null;
  /** Открытый интерес рынка в USD, WAD; `null` — шлюз не вывел. */
  openInterest: bigint | null;
  /** Объём за сутки, WAD; `null` — «не знаем», а не ноль. */
  volumeUsd: bigint | null;
  favorite: boolean;
}

/**
 * Строка списка рынков из полного ответа шлюза.
 *
 * @remarks
 * Плечо считается из `initialMarginBps`, а не берётся из `maxLeverage`
 * `MarketSummary`: последнего `GET /markets` не отдаёт вовсе (это записано в
 * самом SDK), и любой дефолт на его месте выдаёт выдумку за конфигурацию
 * рынка.
 */
export function marketRow(full: MarketFullRow, favorite: boolean): MarketRow {
  const bps = full.initialMarginBps;
  return {
    id: full.id,
    symbol: full.symbol,
    maxLeverage: bps > 0n ? Number(10_000n / bps) : null,
    openInterest: full.dynamic?.openInterest ?? null,
    // `undefined` (поля нет в ответе) и `null` (шлюз не смог посчитать) для
    // экрана — одно утверждение: неизвестно. Ноль сюда не подставляется.
    volumeUsd: full.volume24h?.volumeUsd ?? null,
    favorite,
  };
}

export function useMarketRows(): { rows: MarketRow[]; isLoading: boolean } {
  const { data, isLoading } = useMarketsFullRestQuery();
  const favorites = useTerminalUiStore((s) => s.favoriteMarkets);
  const rows = useMemo(
    () =>
      (data ?? []).map((full) =>
        marketRow(full, favorites.includes(full.id.toString())),
      ),
    [data, favorites],
  );
  return { rows, isLoading };
}
