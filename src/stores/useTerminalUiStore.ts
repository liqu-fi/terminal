import type { OracleCandleInterval } from "@liq/core";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Окно чарта — ключи нижнего ряда рамки. */
export type ChartRangeKey = "1D" | "5D" | "1M" | "3M" | "6M" | "1Y";

/** Чем подписано изменение цены: процентом или деньгами. */
export type ChangeUnit = "pct" | "usd";

/**
 * Режим ценовой шкалы.
 *
 * @remarks Одно поле, а не два флага: `%` и `log` — два значения одного
 * `PriceScaleMode` в lightweight-charts, одновременно их не бывает.
 */
export type ChartScaleMode = "normal" | "percent" | "log";

interface TerminalUiState {
  /** Свёрнут ли чарт — раскладка Frame-12. */
  chartCollapsed: boolean;
  /** Нижняя панель на весь экран — раскладка Frame-13. */
  bottomFullscreen: boolean;
  /**
   * Рынки, отмеченные звездой.
   *
   * @remarks Идентификаторы строками: стор персистится, а `bigint` не
   * переживает `JSON.stringify`.
   */
  favoriteMarkets: string[];
  /** Открытые вкладки рынков, в порядке появления. */
  openMarkets: string[];
  changeUnit: ChangeUnit;
  chartInterval: OracleCandleInterval;
  chartRange: ChartRangeKey;
  chartScaleMode: ChartScaleMode;
  chartAutoScale: boolean;
  /**
   * Открыт ли поиск рынка.
   *
   * @remarks Живёт в сторе, потому что открыть поиск умеют двое — пилюля
   * шапки и `+` полосы вкладок, — а экземпляр поиска обязан остаться один:
   * второй разошёлся бы с первым по избранному и по выбранной области.
   * Не персистится: см. `partialize`.
   */
  searchOpen: boolean;
}

interface TerminalUiActions {
  toggleChart: () => void;
  toggleBottomFullscreen: () => void;
  toggleFavorite: (marketId: string) => void;
  openMarket: (marketId: string) => void;
  closeMarket: (marketId: string) => void;
  setChangeUnit: (unit: ChangeUnit) => void;
  setChartInterval: (interval: OracleCandleInterval) => void;
  setChartRange: (range: ChartRangeKey) => void;
  setChartScaleMode: (mode: ChartScaleMode) => void;
  toggleAutoScale: () => void;
  setSearchOpen: (open: boolean) => void;
  reset: () => void;
}

const INITIAL: TerminalUiState = {
  chartCollapsed: false,
  bottomFullscreen: false,
  favoriteMarkets: [],
  openMarkets: [],
  changeUnit: "pct",
  chartInterval: "1h",
  chartRange: "1D",
  chartScaleMode: "normal",
  chartAutoScale: true,
  searchOpen: false,
};

/**
 * Состояние экрана — то, чего нет и не должно быть в SDK: что свёрнуто, что
 * развёрнуто. Персистится, потому что раскладка терминала — настройка рабочего
 * места, а не сессии.
 *
 * @remarks Состояние ордера сюда не кладётся: им владеет `useTradeStore`
 * из `@liq/react`.
 */
export const useTerminalUiStore = create<TerminalUiState & TerminalUiActions>()(
  persist(
    (set) => ({
      ...INITIAL,
      toggleChart: () => set((s) => ({ chartCollapsed: !s.chartCollapsed })),
      toggleBottomFullscreen: () =>
        set((s) => ({ bottomFullscreen: !s.bottomFullscreen })),
      toggleFavorite: (marketId) =>
        set((s) => ({
          favoriteMarkets: s.favoriteMarkets.includes(marketId)
            ? s.favoriteMarkets.filter((id) => id !== marketId)
            : [...s.favoriteMarkets, marketId],
        })),
      openMarket: (marketId) =>
        set((s) =>
          s.openMarkets.includes(marketId)
            ? s
            : { openMarkets: [...s.openMarkets, marketId] },
        ),
      closeMarket: (marketId) =>
        set((s) =>
          // Последнюю вкладку не закрываем: экран без рынка нечем наполнить —
          // ни книгой, ни тикетом, ни чартом.
          s.openMarkets.length <= 1
            ? s
            : { openMarkets: s.openMarkets.filter((id) => id !== marketId) },
        ),
      setChangeUnit: (changeUnit) => set({ changeUnit }),
      setChartInterval: (chartInterval) => set({ chartInterval }),
      setChartRange: (chartRange) => set({ chartRange }),
      setChartScaleMode: (mode) =>
        set((s) => ({
          // Повторный клик по включённому режиму возвращает обычную шкалу:
          // третьей кнопки «normal» в макете нет, а выйти из режима надо.
          chartScaleMode: s.chartScaleMode === mode ? "normal" : mode,
        })),
      toggleAutoScale: () => set((s) => ({ chartAutoScale: !s.chartAutoScale })),
      setSearchOpen: (searchOpen) => set({ searchOpen }),
      reset: () => set({ ...INITIAL }),
    }),
    {
      name: "terminal-ui",
      storage: createJSONStorage(() => localStorage),
      // Открытый поиск — не настройка рабочего места, а состояние момента:
      // восстановить его при загрузке значит открыть попап тому, кто закрывал
      // его вкладкой браузера.
      partialize: (s) => ({ ...s, searchOpen: false }),
    },
  ),
);
