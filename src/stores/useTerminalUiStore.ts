import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface TerminalUiState {
  /** Свёрнут ли чарт — раскладка Frame-12. */
  chartCollapsed: boolean;
  /** Нижняя панель на весь экран — раскладка Frame-13. */
  bottomFullscreen: boolean;
}

interface TerminalUiActions {
  toggleChart: () => void;
  toggleBottomFullscreen: () => void;
  reset: () => void;
}

const INITIAL: TerminalUiState = {
  chartCollapsed: false,
  bottomFullscreen: false,
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
      reset: () => set({ ...INITIAL }),
    }),
    { name: "terminal-ui", storage: createJSONStorage(() => localStorage) },
  ),
);
