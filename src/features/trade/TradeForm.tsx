import { Price, Qty, Side } from "@liqcx/liq-sdk";
import {
  useAccountId,
  useAvailableMarginQuery,
  useSubmitConditionalOrder,
  useSubmitLimitOrder,
  useSubmitMarketOrder,
} from "@liqcx/liq-react";
import { useMemo, useState } from "react";

import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useSelectedMarket } from "../market/MarketContext";
import { ConditionalFields } from "./ConditionalFields";
import { acceptablePrice, computeSizeDelta } from "./orderMath";
import { TradePreviewRow } from "./TradePreviewRow";
import { useMarkPrice } from "./useMarkPrice";

const TABS = ["Market", "Limit", "Stop", "Take Profit"] as const;
type Tab = (typeof TABS)[number];

const SLIPPAGE_BPS = 50n; // 0.5%

export function TradeForm() {
  const { marketId } = useSelectedMarket();
  const accountId = useAccountId();
  const markPrice = useMarkPrice();
  const { data: margins } = useAvailableMarginQuery();

  const market = useSubmitMarketOrder();
  const limit = useSubmitLimitOrder();
  const conditional = useSubmitConditionalOrder();

  const [tab, setTab] = useState<Tab>("Market");
  const [side, setSide] = useState<Side>(Side.BUY);
  const [size, setSize] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [triggerAbove, setTriggerAbove] = useState(true);

  const sizeQty = useMemo(() => {
    try {
      return size ? Qty.parse(size) : 0n;
    } catch {
      return 0n;
    }
  }, [size]);
  const sizeDelta = computeSizeDelta(sizeQty, side);

  const pending = market.isPending || limit.isPending || conditional.isPending;
  const error = market.error ?? limit.error ?? conditional.error;
  const insufficientMargin = !margins || margins.available === 0n;
  const disabled =
    pending ||
    accountId === undefined ||
    marketId === undefined ||
    sizeQty === 0n ||
    insufficientMargin;

  async function submit() {
    if (accountId === undefined || marketId === undefined) return;
    if (tab === "Market") {
      await market.mutateAsync({
        accountId,
        marketId,
        sizeDelta,
        side,
        acceptablePrice: acceptablePrice(markPrice, side, SLIPPAGE_BPS),
      });
    } else if (tab === "Limit") {
      const lp = Price.parse(limitPrice);
      await limit.mutateAsync({
        accountId,
        marketId,
        sizeDelta,
        side,
        limitPrice: lp,
        acceptablePrice: lp,
      });
    } else {
      await conditional.mutateAsync({
        accountId,
        marketId,
        sizeDelta,
        side,
        orderType: tab === "Stop" ? "STOP_MARKET" : "TAKE_PROFIT_MARKET",
        triggerPrice: Price.parse(triggerPrice),
        triggerAbove,
      });
    }
    setSize("");
  }

  const long = side === Side.BUY;
  return (
    <div className="flex w-[240px] shrink-0 flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3">
      <div className="flex gap-1 text-[11px]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-[var(--radius-sm)] py-1 ${tab === t ? "bg-surface-2 text-text" : "text-muted"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          variant={long ? "long" : "ghost"}
          className="flex-1"
          onClick={() => setSide(Side.BUY)}
        >
          Long
        </Button>
        <Button
          variant={!long ? "short" : "ghost"}
          className="flex-1"
          onClick={() => setSide(Side.SELL)}
        >
          Short
        </Button>
      </div>

      <div>
        <label className="mb-1 block text-[10px] uppercase text-muted">
          Size
        </label>
        <Input
          inputMode="decimal"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          placeholder="0.00"
        />
      </div>

      {tab === "Limit" && (
        <div>
          <label className="mb-1 block text-[10px] uppercase text-muted">
            Limit price
          </label>
          <Input
            inputMode="decimal"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            placeholder="0.00"
          />
        </div>
      )}

      {(tab === "Stop" || tab === "Take Profit") && (
        <ConditionalFields
          triggerPrice={triggerPrice}
          setTriggerPrice={setTriggerPrice}
          triggerAbove={triggerAbove}
          setTriggerAbove={setTriggerAbove}
        />
      )}

      <TradePreviewRow
        marketId={marketId}
        sizeDelta={sizeDelta}
        markPrice={markPrice}
      />

      <Button
        variant={long ? "long" : "short"}
        disabled={disabled}
        onClick={() => void submit()}
      >
        {pending ? "Submitting…" : `${long ? "Buy / Long" : "Sell / Short"}`}
      </Button>

      {insufficientMargin && (
        <p className="text-[10px] text-muted">
          No available margin — deposit to trade.
        </p>
      )}
      {error && <p className="text-[10px] text-short">{error.message}</p>}
    </div>
  );
}
