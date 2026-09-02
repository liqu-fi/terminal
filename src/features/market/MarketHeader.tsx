import { compactUsd } from "@liq/core";
import { useAvailableMarginQuery, usePricesQuery } from "@liq/react";
import { useState } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

import { DASH, fmtPrice, fmtUsd, toNum } from "../../lib/format";
import { DepositDialog } from "../account/DepositDialog";
import { WithdrawDialog } from "../account/WithdrawDialog";
import { MarketSearch } from "./MarketSearch";
import { MarketStat } from "./MarketStat";
import { useDailyChange } from "./useDailyChange";
import { useFunding } from "./useFunding";
import { useMarketRows } from "./useMarketRows";
import { useSelectedMarket } from "./useSelectedMarket";

export function MarketHeader() {
  const { marketId, marketIds } = useSelectedMarket();
  const { data: prices } = usePricesQuery(marketIds);
  const { data: funding } = useFunding(marketId);
  const { data: margins } = useAvailableMarginQuery();
  const { change } = useDailyChange(marketId);
  const { rows } = useMarketRows();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const info =
    marketId !== undefined ? prices?.[marketId.toString()] : undefined;
  const row = rows.find((r) => r.id === marketId);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-6" data-testid="market-header">
        <MarketSearch />
        <div className="flex flex-col">
          <span
            className="text-lg font-bold text-text tabular-nums"
            data-testid="market-price"
          >
            {info ? `$${fmtPrice(info.price)}` : DASH}
          </span>
          <span
            className={`text-[11px] tabular-nums ${
              change && change.pct < 0 ? "text-short" : "text-long"
            }`}
            data-testid="market-change"
          >
            {change
              ? `${change.pct >= 0 ? "+" : ""}${change.pct.toFixed(2)}%`
              : DASH}
          </span>
        </div>

        <MarketStat label="Mark Price" testid="stat-mark-price">
          {info ? fmtPrice(info.price) : DASH}
        </MarketStat>
        <MarketStat
          label="Spot Price"
          testid="stat-spot-price"
          note="Спотового рынка у контура нет, а индексная цена — тот же фид Pyth, что и Mark. Показать одно число под двумя подписями значило бы заявить два измерения."
        >
          {DASH}
        </MarketStat>
        <MarketStat
          label="Funding Rate"
          testid="stat-funding"
          note="Фандинг начисляется непрерывно — момента следующего списания не существует, отсчитывать нечего."
        >
          {/* Суточная ставка, WAD, знаковая. Пустой снимок (синк лежит, рынок
              новый, шлюз старее 0.34.0) обязан быть прочерком: его null,
              отформатированный числом, показал бы измеренные 0.0000 %. */}
          <span data-testid="funding-rate">
            {funding?.available && funding.rate !== null
              ? `${(toNum(funding.rate) * 100).toFixed(4)}%`
              : DASH}
          </span>
        </MarketStat>
        <MarketStat label="Open Interest" testid="stat-open-interest">
          {row?.openInterest == null ? DASH : compactUsd(row.openInterest)}
        </MarketStat>
        <MarketStat label="24h Volume" testid="stat-volume-24h">
          {row?.volumeUsd == null ? DASH : compactUsd(row.volumeUsd)}
        </MarketStat>

        <div className="flex-1" />
        <span className="text-xs text-muted">
          margin{" "}
          <span
            className="font-semibold text-text"
            data-testid="available-margin"
          >
            {margins ? fmtUsd(margins.available) : DASH}
          </span>
        </span>
        <button
          type="button"
          className="text-[11px] text-accent"
          onClick={() => setDepositOpen(true)}
          data-testid="open-deposit-button"
        >
          Deposit
        </button>
        <button
          type="button"
          className="text-[11px] text-muted"
          onClick={() => setWithdrawOpen(true)}
          data-testid="open-withdraw-button"
        >
          Withdraw
        </button>
        <DepositDialog
          open={depositOpen}
          onClose={() => setDepositOpen(false)}
        />
        <WithdrawDialog
          open={withdrawOpen}
          onClose={() => setWithdrawOpen(false)}
        />
      </div>
    </TooltipProvider>
  );
}
