import { Price, Side } from "@liq/sdk";
import {
  useAccountId,
  useAvailableMarginQuery,
  useSubmitConditionalOrder,
  useSubmitLimitOrder,
  useSubmitMarketOrder,
} from "@liq/react";
import { useState } from "react";

import { Button } from "../../components/ui/Button";
import { DecimalInput } from "../../components/ui/DecimalInput";
import { fmtPrice, fmtUsd } from "../../lib/format";
import { useSelectedMarket } from "../market/useSelectedMarket";
import { ConditionalFields } from "./ConditionalFields";
import { EntryTpSlFields } from "./EntryTpSlFields";
import { acceptablePrice } from "./orderMath";
import { SizeField } from "./SizeField";
import { SizePercent } from "./SizePercent";
import { TradePreviewRow } from "./TradePreviewRow";
import { useMarkPrice } from "./useMarkPrice";
import { useOrderSizing } from "./useOrderSizing";

const TABS = ["Market", "Limit", "Stop", "Take Profit"] as const;
type Tab = (typeof TABS)[number];

const SLIPPAGE_BPS = 50n; // 0.5%

export function TradeForm() {
  const { marketId, market } = useSelectedMarket();
  const accountId = useAccountId();
  const markPrice = useMarkPrice();
  const { data: margins } = useAvailableMarginQuery();

  const submitMarket = useSubmitMarketOrder();
  const limit = useSubmitLimitOrder();
  const conditional = useSubmitConditionalOrder();

  const [tab, setTab] = useState<Tab>("Market");
  const [side, setSide] = useState<Side>(Side.BUY);
  const [limitPrice, setLimitPrice] = useState("");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [triggerAbove, setTriggerAbove] = useState(true);
  const [tpslOn, setTpslOn] = useState(false);
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");

  const sizing = useOrderSizing({
    market,
    available: margins?.available ?? 0n,
    markPrice,
    side,
  });
  const maxLev = market?.maxLeverage ?? 25;
  const attachable = tab === "Market" || tab === "Limit";

  const pending =
    submitMarket.isPending || limit.isPending || conditional.isPending;
  const error = submitMarket.error ?? limit.error ?? conditional.error;
  const insufficientMargin = !margins || margins.available === 0n;

  // The active tab's price field, parsed (0n = blank/unparseable).
  function parsedTabPrice(): bigint {
    const raw = tab === "Limit" ? limitPrice : triggerPrice;
    if (tab === "Market") return markPrice;
    try {
      return Price.parse(raw);
    } catch {
      return 0n;
    }
  }
  const tabPriceReady = parsedTabPrice() > 0n;

  const disabled =
    pending ||
    accountId === undefined ||
    marketId === undefined ||
    insufficientMargin ||
    !sizing.validation.ok ||
    !tabPriceReady;

  // Reduce-only TP/SL submitted after a confirmed entry (best-effort, not
  // atomic). Long: TP triggers above, SL below; short: mirrored. Closing side
  // and delta are the inverse of the entry.
  function submitAttachedTpSl(entryDelta: bigint, entrySide: Side) {
    if (!tpslOn || accountId === undefined || marketId === undefined) return;
    const long = entrySide === Side.BUY;
    const closeDelta = -entryDelta;
    const closeSide = long ? Side.SELL : Side.BUY;
    const fire = (
      raw: string,
      orderType: "TAKE_PROFIT_MARKET" | "STOP_MARKET",
      above: boolean,
    ) => {
      if (!raw) return;
      let triggerPrice: bigint;
      try {
        triggerPrice = Price.parse(raw);
      } catch {
        return;
      }
      if (triggerPrice <= 0n) return;
      conditional.mutate({
        accountId,
        marketId,
        sizeDelta: closeDelta,
        side: closeSide,
        orderType,
        triggerPrice,
        triggerAbove: above,
        // Reduce-only: an attached TP/SL must only close the entry position. If
        // it fires after the position is already gone, the matching engine
        // rejects it instead of opening an unintended opposite position.
        reduceOnly: true,
      });
    };
    fire(tp, "TAKE_PROFIT_MARKET", long);
    fire(sl, "STOP_MARKET", !long);
  }

  // `mutate` (not `mutateAsync`): a rejected submit surfaces via the mutation's
  // `error` (the trade-error row below), never as an unhandled rejection from
  // the click handler. The form is cleared only after a confirmed submit.
  function submit() {
    if (accountId === undefined || marketId === undefined) return;
    const sizeDelta = sizing.sizeDelta;
    const onSuccess = () => {
      sizing.reset();
      // Fire the attached orders from the just-submitted prices, THEN clear the
      // TP/SL fields — otherwise the next entry on this tab would re-attach the
      // stale prices (the form clears only on a confirmed submit).
      submitAttachedTpSl(sizeDelta, side);
      setTp("");
      setSl("");
    };

    if (tab === "Market") {
      submitMarket.mutate(
        {
          accountId,
          marketId,
          sizeDelta,
          side,
          acceptablePrice: acceptablePrice(markPrice, side, SLIPPAGE_BPS),
        },
        { onSuccess },
      );
      return;
    }

    const price = parsedTabPrice();
    if (price <= 0n) return;

    if (tab === "Limit") {
      limit.mutate(
        {
          accountId,
          marketId,
          sizeDelta,
          side,
          limitPrice: price,
          acceptablePrice: price,
        },
        { onSuccess },
      );
    } else {
      conditional.mutate(
        {
          accountId,
          marketId,
          sizeDelta,
          side,
          orderType: tab === "Stop" ? "STOP_MARKET" : "TAKE_PROFIT_MARKET",
          triggerPrice: price,
          triggerAbove,
        },
        { onSuccess },
      );
    }
  }

  const long = side === Side.BUY;
  const submitLabel = !sizing.validation.ok
    ? (sizing.validation.reason ?? (long ? "Buy / Long" : "Sell / Short"))
    : pending
      ? "Submitting…"
      : long
        ? "Buy / Long"
        : "Sell / Short";

  return (
    <div
      className="flex w-[240px] shrink-0 flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3"
      data-testid="trade-form"
    >
      <div className="flex gap-1 text-[11px]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-[var(--radius-sm)] py-1 ${tab === t ? "bg-surface-2 text-text" : "text-muted"}`}
            data-testid={`trade-tab-${tabSlug(t)}`}
            aria-pressed={tab === t}
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
          data-testid="side-long-button"
          aria-pressed={long}
        >
          Long
        </Button>
        <Button
          variant={!long ? "short" : "ghost"}
          className="flex-1"
          onClick={() => setSide(Side.SELL)}
          data-testid="side-short-button"
          aria-pressed={!long}
        >
          Short
        </Button>
      </div>

      {tab === "Limit" && (
        <div>
          <label className="mb-1 block text-[10px] uppercase text-muted">
            Limit price
          </label>
          <DecimalInput
            value={limitPrice}
            onValueChange={setLimitPrice}
            maxDecimals={2}
            placeholder="0.00"
            data-testid="limit-price-input"
          />
        </div>
      )}

      <SizeField
        value={sizing.sizeStr}
        onChange={sizing.setSizeStr}
        unit={sizing.unit}
        onToggleUnit={sizing.toggleUnit}
        onMax={sizing.setMax}
        baseSymbol={sizing.baseSymbol}
        invalid={!!sizing.validation.reason}
        toggleDisabled={markPrice === 0n}
      />

      <SizePercent
        pct={sizing.pct}
        onPct={sizing.setPct}
        disabled={insufficientMargin || markPrice === 0n}
      />

      <div>
        <div className="mb-1 flex justify-between text-[10px] uppercase text-muted">
          <span>Leverage</span>
          <span className="text-text" data-testid="leverage-value">
            {sizing.leverage}×
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={maxLev}
          step={1}
          value={sizing.leverage}
          data-testid="leverage-slider"
          onChange={(e) => sizing.setLeverage(Number(e.target.value))}
          className="w-full accent-accent"
        />
      </div>

      {(tab === "Stop" || tab === "Take Profit") && (
        <ConditionalFields
          triggerPrice={triggerPrice}
          setTriggerPrice={setTriggerPrice}
          triggerAbove={triggerAbove}
          setTriggerAbove={setTriggerAbove}
        />
      )}

      {attachable && (
        <EntryTpSlFields
          enabled={tpslOn}
          onToggle={setTpslOn}
          tp={tp}
          setTp={setTp}
          sl={sl}
          setSl={setSl}
        />
      )}

      {sizing.sizeQty > 0n && (
        <div
          className="rounded-[var(--radius-sm)] border border-border bg-surface-2 p-2 text-[11px] text-muted"
          data-testid="order-summary"
        >
          <SummaryRow label="Notional" value={fmtUsd(sizing.notional)} />
          <SummaryRow
            label="Margin"
            value={fmtUsd(sizing.margin)}
            testid="order-margin"
          />
          <SummaryRow
            label="Est. liq. price"
            value={sizing.liqPrice !== null ? fmtPrice(sizing.liqPrice) : "—"}
            testid="order-liq-price"
          />
        </div>
      )}

      <TradePreviewRow
        marketId={marketId}
        sizeDelta={sizing.sizeDelta}
        markPrice={markPrice}
      />

      <Button
        variant={long ? "long" : "short"}
        disabled={disabled}
        onClick={submit}
        data-testid="submit-order-button"
      >
        {submitLabel}
      </Button>

      {sizing.validation.warn && !insufficientMargin && (
        <p className="text-[10px] text-short/80" data-testid="order-warning">
          {sizing.validation.warn}
        </p>
      )}
      {insufficientMargin && (
        <p className="text-[10px] text-muted" data-testid="insufficient-margin">
          No available margin — deposit to trade.
        </p>
      )}
      {error && (
        <p className="text-[10px] text-short" data-testid="trade-error">
          {error.message}
        </p>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  testid,
}: {
  label: string;
  value: string;
  testid?: string;
}) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="text-text" data-testid={testid}>
        {value}
      </span>
    </div>
  );
}

const TAB_SLUG: Record<Tab, string> = {
  Market: "market",
  Limit: "limit",
  Stop: "stop",
  "Take Profit": "take-profit",
};

function tabSlug(tab: Tab): string {
  return TAB_SLUG[tab];
}
