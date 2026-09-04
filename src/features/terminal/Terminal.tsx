import { PanelBottomClose, PanelBottomOpen } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useTerminalUiStore } from "@/stores/useTerminalUiStore";

import { AccountPanel } from "../account/AccountPanel";
import { ChartFrame } from "../chart/ChartFrame";
import { MarketHeader } from "../market/MarketHeader";
import { MarketTabs } from "../market/MarketTabs";
import { useSelectedMarket } from "../market/useSelectedMarket";
import { OrderBookPanel } from "../orderbook/OrderBookPanel";
import { TradeForm } from "../trade/TradeForm";
import { UserInfoTabs } from "../userinfo/UserInfoTabs";

// react-resizable-panels@4 treats a numeric `defaultSize`/`minSize`/`maxSize`
// as PIXELS (see the library's `PanelProps` doc comment) — a bare string is
// what means percent-of-group. Every size below is a string on purpose; only
// the collapsed chart-column strip is intentionally pixel-fixed ("Npx").
const CHART_STRIP_PX = "32px";

/**
 * Нижние границы колонок в пикселях, а не в процентах.
 *
 * @remarks Процент от группы на узком экране даёт колонку, в которую контент не
 * влезает по ширине: 14% от 1280px — это 179px на стакан из трёх числовых
 * колонок, а 20% — 256px на тикет, чьи кнопки Buy/Sell перестают помещаться
 * рядом. Пиксели держат нижнюю границу одинаковой на любом экране; выше неё
 * пользователь волен тянуть ручку как хочет.
 */
const BOOK_MIN_PX = "200px";
const TICKET_MIN_PX = "300px";

export function Terminal() {
  const { marketId } = useSelectedMarket();
  const chartCollapsed = useTerminalUiStore((s) => s.chartCollapsed);
  const bottomFullscreen = useTerminalUiStore((s) => s.bottomFullscreen);
  const toggleChart = useTerminalUiStore((s) => s.toggleChart);

  const chartToggle = (
    <button
      type="button"
      onClick={toggleChart}
      data-testid="chart-collapse-toggle"
      aria-label={chartCollapsed ? "Развернуть чарт" : "Свернуть чарт"}
      className="text-muted hover:text-text"
    >
      {chartCollapsed ? (
        <PanelBottomOpen size={16} />
      ) : (
        <PanelBottomClose size={16} />
      )}
    </button>
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-2"
      data-testid="terminal-root"
    >
      {!bottomFullscreen && <MarketTabs />}
      {!bottomFullscreen && <MarketHeader />}
      <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
        {!bottomFullscreen && (
          <>
            <ResizablePanel id="chart-row" defaultSize="64" minSize="25">
              {/* Keyed by collapse state: `defaultSize`/`minSize`/`maxSize`
                  are only consulted when a panel first registers with the
                  group, so freeing the chart column's width on collapse
                  needs a fresh mount, not just a prop change. Remounting
                  (rather than the library's own `collapsible` +
                  `collapsedSize`) also means there is no drag-to-collapse
                  gesture to fall out of sync with `useTerminalUiStore` —
                  the store's boolean is the only thing that decides which
                  layout is mounted. */}
              <ResizablePanelGroup
                key={chartCollapsed ? "chart-collapsed" : "chart-expanded"}
                orientation="horizontal"
              >
                <ResizablePanel
                  id="chart-column"
                  defaultSize={chartCollapsed ? CHART_STRIP_PX : "56"}
                  minSize={chartCollapsed ? CHART_STRIP_PX : "320px"}
                  maxSize={chartCollapsed ? CHART_STRIP_PX : undefined}
                >
                  {chartCollapsed ? (
                    <div className="flex h-full justify-center pt-1">
                      {chartToggle}
                    </div>
                  ) : (
                    <Card
                      className="flex min-h-0 flex-1 flex-col overflow-hidden p-2"
                      data-testid="chart-panel"
                    >
                      {/* Кнопка свёртки живёт в строке интервалов чарта, а не
                          отдельным рядом над карточкой: своя строка съедала
                          ~28px высоты у самого высокого блока экрана ради
                          одной иконки. */}
                      <ChartFrame marketId={marketId} actions={chartToggle} />
                    </Card>
                  )}
                </ResizablePanel>
                {/* Locked to CHART_STRIP_PX on both sides while collapsed —
                    nothing to drag, so the handle is disabled rather than
                    left as a dead affordance. */}
                <ResizableHandle withHandle disabled={chartCollapsed} />
                <ResizablePanel
                  id="book-column"
                  defaultSize={chartCollapsed ? "35" : "18"}
                  minSize={BOOK_MIN_PX}
                >
                  <OrderBookPanel />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel
                  id="trade-column"
                  defaultSize={chartCollapsed ? "65" : "26"}
                  minSize={TICKET_MIN_PX}
                >
                  <div
                    className="flex h-full min-h-0 flex-col gap-2"
                    data-testid="trade-column"
                  >
                    {/* Тикет забирает всю свободную высоту и прокручивает
                        поля внутри себя, оставляя кнопки подачи на виду.
                        Карточка счёта под ним не сжимается: колонка отдаёт
                        высоту тикету, а не подвалу. */}
                    <div className="min-h-0 flex-1">
                      <TradeForm />
                    </div>
                    <AccountPanel />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}
        <ResizablePanel
          id="bottom-row"
          defaultSize={bottomFullscreen ? "100" : "36"}
          minSize="20"
        >
          <div
            className="flex h-full min-h-0 flex-col"
            data-testid="bottom-panel"
          >
            <UserInfoTabs />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
