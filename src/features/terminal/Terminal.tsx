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
import { TradeForm } from "../trade/TradeForm";
import { UserInfoTabs } from "../userinfo/UserInfoTabs";

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
            <ResizablePanel id="chart-row" defaultSize={55} minSize={25}>
              <ResizablePanelGroup orientation="horizontal">
                <ResizablePanel id="chart-column" defaultSize={70} minSize={40}>
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
                <ResizableHandle withHandle />
                <ResizablePanel id="trade-column" defaultSize={30} minSize={20}>
                  <TradeForm />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}
        <ResizablePanel
          id="bottom-row"
          defaultSize={bottomFullscreen ? 100 : 45}
          minSize={20}
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
