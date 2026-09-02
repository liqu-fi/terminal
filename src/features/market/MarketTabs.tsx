import { Plus, X } from "lucide-react";

import { useTerminalUiStore } from "@/stores/useTerminalUiStore";

import { DASH, fmtSignedUsd } from "../../lib/format";
import { useDailyChange } from "./useDailyChange";
import { useSelectedMarket } from "./useSelectedMarket";

const QUOTE = "USD";

function TabChange({ id }: { id: bigint }) {
  const unit = useTerminalUiStore((s) => s.changeUnit);
  const { change } = useDailyChange(id);
  if (!change) return <span className="text-muted">{DASH}</span>;
  return (
    <span className={change.pct < 0 ? "text-short" : "text-long"}>
      {unit === "pct"
        ? `${change.pct >= 0 ? "+" : ""}${change.pct.toFixed(2)}%`
        : fmtSignedUsd(change.abs)}
    </span>
  );
}

export function MarketTabs() {
  const { markets, marketId, setMarketId } = useSelectedMarket();
  const openMarkets = useTerminalUiStore((s) => s.openMarkets);
  const changeUnit = useTerminalUiStore((s) => s.changeUnit);
  const setChangeUnit = useTerminalUiStore((s) => s.setChangeUnit);
  const closeMarket = useTerminalUiStore((s) => s.closeMarket);
  const setSearchOpen = useTerminalUiStore((s) => s.setSearchOpen);

  // Первое открытие экрана: вкладок в сторе нет, а рынок уже выбран — он и
  // становится единственной вкладкой. Иначе полоса пуста при выбранном рынке.
  const ids = openMarkets.length
    ? openMarkets
    : marketId !== undefined
      ? [marketId.toString()]
      : [];

  return (
    <div
      className="flex items-center gap-1 border-b border-border px-2 py-1"
      data-testid="market-tabs"
    >
      <button
        type="button"
        data-testid="change-unit-pct"
        data-active={changeUnit === "pct" ? "true" : "false"}
        onClick={() => setChangeUnit("pct")}
        className={`rounded px-1.5 text-xs ${
          changeUnit === "pct" ? "bg-surface-2 text-text" : "text-muted"
        }`}
      >
        %
      </button>
      <button
        type="button"
        data-testid="change-unit-usd"
        data-active={changeUnit === "usd" ? "true" : "false"}
        onClick={() => setChangeUnit("usd")}
        className={`rounded px-1.5 text-xs ${
          changeUnit === "usd" ? "bg-surface-2 text-text" : "text-muted"
        }`}
      >
        $
      </button>
      <div className="mx-2 h-4 w-px bg-border" />
      {ids.map((id) => {
        const market = markets.find((m) => m.id.toString() === id);
        const active = marketId?.toString() === id;
        return (
          <div
            key={id}
            data-testid={`market-tab-${id}`}
            data-active={active ? "true" : "false"}
            className={`flex items-center gap-2 rounded-t px-2 py-1 text-xs ${
              active ? "bg-surface-2 text-text" : "text-muted"
            }`}
          >
            <button
              type="button"
              className="flex items-center gap-1"
              onClick={() => setMarketId(BigInt(id))}
            >
              <span className="font-semibold">{market?.symbol ?? id}</span>
              <span className="text-muted">{QUOTE}</span>
              <TabChange id={BigInt(id)} />
            </button>
            <button
              type="button"
              aria-label="Close tab"
              data-testid={`market-tab-close-${id}`}
              onClick={() => closeMarket(id)}
              className="text-muted hover:text-text"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        aria-label="Add market"
        data-testid="market-tabs-add"
        onClick={() => setSearchOpen(true)}
        className="text-muted hover:text-text"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
