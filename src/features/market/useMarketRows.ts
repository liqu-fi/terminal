import type { MarketFullRow } from "@liq/api-client";
import { maxLeverageFromBps } from "@liq/core";
import { useMarketsFullRestQuery } from "@liq/react";
import { useMemo } from "react";

import { useTerminalUiStore } from "@/stores/useTerminalUiStore";

import { useSelectedMarket } from "./useSelectedMarket";

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
 * Плечо считается из `initialMarginBps` — тем же `maxLeverageFromBps`, что
 * читает тикет: два места, считающие одно и то же по-своему, расходятся молча.
 * `maxLeverage` в `MarketSummary` не существует с 0.46.0: поле обещало то,
 * чего `GET /markets` не слал, и любой дефолт на его месте выдавал выдумку за
 * конфигурацию рынка.
 */
export function marketRow(full: MarketFullRow, favorite: boolean): MarketRow {
  return {
    id: full.id,
    symbol: full.symbol,
    maxLeverage: maxLeverageFromBps(full.initialMarginBps),
    openInterest: full.dynamic?.openInterest ?? null,
    // `undefined` (поля нет в ответе) и `null` (шлюз не смог посчитать) для
    // экрана — одно утверждение: неизвестно. Ноль сюда не подставляется.
    volumeUsd: full.volume24h?.volumeUsd ?? null,
    favorite,
  };
}

/** Рынок, который `/markets` назвал, а `/markets/full` ещё не обогатил. */
export function bareRow(
  id: bigint,
  symbol: string,
  favorite: boolean,
): MarketRow {
  return {
    id,
    symbol,
    maxLeverage: null,
    openInterest: null,
    volumeUsd: null,
    favorite,
  };
}

/**
 * Строки списка рынков.
 *
 * @remarks
 * Вселенную задаёт `/markets` — тот же список, на котором стоит весь экран, —
 * а `/markets/full` только обогащает её. Иначе поиск предлагал бы рынок,
 * которого не знают ни книга, ни тикет, ни чарт, и выбор его ломал бы экран.
 */
export function useMarketRows(): { rows: MarketRow[]; isLoading: boolean } {
  const { markets } = useSelectedMarket();
  const { data, isLoading } = useMarketsFullRestQuery();
  const favorites = useTerminalUiStore((s) => s.favoriteMarkets);
  const rows = useMemo(
    () =>
      markets.map((m) => {
        const favorite = favorites.includes(m.id.toString());
        const full = data?.find((f) => f.id === m.id);
        return full ? marketRow(full, favorite) : bareRow(m.id, m.symbol, favorite);
      }),
    [markets, data, favorites],
  );
  return { rows, isLoading };
}
