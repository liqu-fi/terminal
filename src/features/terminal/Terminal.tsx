import {
  Maximize2,
  Minimize2,
  PanelBottomClose,
  PanelBottomOpen,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useTerminalUiStore } from "@/stores/useTerminalUiStore";

import { CandleChart } from "../chart/CandleChart";
import { MarketHeader } from "../market/MarketHeader";
import { useSelectedMarket } from "../market/useSelectedMarket";
import { OrderBookPanel } from "../orderbook/OrderBookPanel";
import { TradeForm } from "../trade/TradeForm";
import { UserInfoTabs } from "../userinfo/UserInfoTabs";

// react-resizable-panels@4 treats a numeric `defaultSize`/`minSize`/`maxSize`
// as PIXELS (see the library's `PanelProps` doc comment) — a bare string is
// what means percent-of-group. Every size below is a string on purpose; only
// the collapsed chart-column strip is intentionally pixel-fixed ("Npx").
const CHART_STRIP_PX = "44px";

export function Terminal() {
  const { marketId } = useSelectedMarket();
  const chartCollapsed = useTerminalUiStore((s) => s.chartCollapsed);
  const bottomFullscreen = useTerminalUiStore((s) => s.bottomFullscreen);
  const toggleChart = useTerminalUiStore((s) => s.toggleChart);
  const toggleBottomFullscreen = useTerminalUiStore(
    (s) => s.toggleBottomFullscreen,
  );

  return (
    <div className="flex flex-1 flex-col gap-3" data-testid="terminal-root">
      {!bottomFullscreen && <MarketHeader />}
      <ResizablePanelGroup orientation="vertical" className="flex-1">
        {!bottomFullscreen && (
          <>
            <ResizablePanel id="chart-row" defaultSize="55" minSize="25">
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
                  minSize={chartCollapsed ? CHART_STRIP_PX : "40"}
                  maxSize={chartCollapsed ? CHART_STRIP_PX : undefined}
                >
                  <div className="flex h-full flex-col gap-2">
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={toggleChart}
                        data-testid="chart-collapse-toggle"
                        aria-label={
                          chartCollapsed ? "Развернуть чарт" : "Свернуть чарт"
                        }
                        className="text-muted hover:text-text"
                      >
                        {chartCollapsed ? (
                          <PanelBottomOpen size={16} />
                        ) : (
                          <PanelBottomClose size={16} />
                        )}
                      </button>
                    </div>
                    {!chartCollapsed && (
                      <Card className="flex-1 p-2" data-testid="chart-panel">
                        <CandleChart marketId={marketId} />
                      </Card>
                    )}
                  </div>
                </ResizablePanel>
                {/* Locked to CHART_STRIP_PX on both sides while collapsed —
                    nothing to drag, so the handle is disabled rather than
                    left as a dead affordance. */}
                <ResizableHandle withHandle disabled={chartCollapsed} />
                <ResizablePanel
                  id="book-column"
                  defaultSize={chartCollapsed ? "35" : "18"}
                  minSize="14"
                >
                  <OrderBookPanel />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel
                  id="trade-column"
                  defaultSize={chartCollapsed ? "65" : "26"}
                  minSize="20"
                >
                  <TradeForm />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}
        <ResizablePanel
          id="bottom-row"
          defaultSize={bottomFullscreen ? "100" : "45"}
          minSize="20"
        >
          <div className="flex h-full flex-col" data-testid="bottom-panel">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={toggleBottomFullscreen}
                data-testid="bottom-fullscreen-toggle"
                aria-label={
                  bottomFullscreen ? "Свернуть панель" : "Развернуть панель"
                }
                className="text-muted hover:text-text"
              >
                {bottomFullscreen ? (
                  <Minimize2 size={16} />
                ) : (
                  <Maximize2 size={16} />
                )}
              </button>
            </div>
            <UserInfoTabs />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
