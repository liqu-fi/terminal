import {
  useConditionalOrders,
  useEnrichedPositions,
  usePricesQuery,
} from "@liq/react";
import { abs, type GatewayOrder, Side } from "@liq/sdk";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";

import { DataTable, MARKET_COLUMN_ID } from "@/components/data-table/DataTable";
import { features, marketFilterFn } from "@/components/data-table/features";

import {
  DASH,
  fmtLeverage,
  fmtPrice,
  fmtQty,
  fmtSignedPct,
  fmtSignedUsd,
  fmtUsd,
} from "../../lib/format";
import { useSelectedMarket } from "../market/useSelectedMarket";

type EnrichedPosition = NonNullable<
  ReturnType<typeof useEnrichedPositions>["data"]
>[number];

/** Строка таблицы: позиция плюс то, что к ней приклеено с других запросов. */
interface PositionRow {
  position: EnrichedPosition;
  symbol: string;
  markPrice: bigint | undefined;
  takeProfit: bigint | undefined;
  stopLoss: bigint | undefined;
}

const helper = createColumnHelper<typeof features, PositionRow>();

const columns = helper.columns([
  helper.accessor((r) => r.symbol, {
    id: MARKET_COLUMN_ID,
    header: "Market",
    enableHiding: false,
    filterFn: (row, _id, value) =>
      marketFilterFn(row.original.position.marketId.toString(), value),
    cell: (info) => <span className="font-semibold">{info.getValue()}</span>,
  }),
  helper.accessor((r) => (r.position.side === Side.BUY ? 1 : 0), {
    id: "side",
    header: "Side",
    cell: (info) => {
      const p = info.row.original.position;
      const long = p.side === Side.BUY;
      return (
        <span className="inline-flex items-center gap-1">
          <span
            className={`rounded-sm px-1 text-[11px] ${long ? "bg-long-soft text-long" : "bg-short-soft text-short"}`}
          >
            {long ? "Long" : "Short"}
          </span>
          <span className="rounded-sm bg-surface-2 px-1 text-[11px] text-muted">
            {fmtLeverage(p.leverage)}
          </span>
        </span>
      );
    },
  }),
  helper.accessor((r) => Number(r.position.notional), {
    id: "value",
    header: "Value / Size",
    cell: (info) => {
      const r = info.row.original;
      return (
        <span className="flex flex-col leading-tight">
          <span>{fmtUsd(r.position.notional)}</span>
          <span className="text-[11px] text-muted">
            ≈ {fmtQty(abs(r.position.size))}
          </span>
        </span>
      );
    },
  }),
  helper.accessor((r) => Number(r.position.entryPrice), {
    id: "entry",
    header: "Entry Price",
    cell: (info) => fmtPrice(info.row.original.position.entryPrice),
  }),
  helper.accessor((r) => Number(r.markPrice ?? 0n), {
    id: "mark",
    header: "Mark Price",
    cell: (info) => {
      const mark = info.row.original.markPrice;
      return mark === undefined ? DASH : fmtPrice(mark);
    },
  }),
  helper.accessor((r) => Number(r.position.liquidationPrice), {
    id: "liq",
    header: "Liq. Price",
    // ZERO_PRICE — «показывать нечего» (неизвестный марк, плоская позиция,
    // уровень ниже нуля), а не цена ноль.
    cell: (info) => {
      const liq = info.row.original.position.liquidationPrice;
      return liq === 0n ? DASH : fmtPrice(liq);
    },
  }),
  helper.accessor((r) => Number(r.position.initialMarginUsd ?? 0n), {
    id: "margin",
    header: "Margin",
    cell: (info) => {
      const m = info.row.original.position.initialMarginUsd;
      return m === undefined ? DASH : fmtUsd(m);
    },
  }),
  helper.accessor((r) => Number(r.position.accruedFunding ?? 0n), {
    id: "funding",
    header: "Funding",
    // `undefined` — «фандинг не известен». Ноль читался бы как «платежей не было».
    cell: (info) => {
      const f = info.row.original.position.accruedFunding;
      return f === undefined ? DASH : fmtSignedUsd(f);
    },
  }),
  helper.accessor((r) => Number(r.position.unrealizedPnl), {
    id: "upnl",
    header: "Unrealized P&L",
    cell: (info) => {
      const p = info.row.original.position;
      const tone = p.unrealizedPnl < 0n ? "text-short" : "text-long";
      return (
        <span className={`flex flex-col leading-tight ${tone}`}>
          <span>{fmtSignedUsd(p.unrealizedPnl)}</span>
          <span className="text-[11px]">{fmtSignedPct(p.pnlRatio)}</span>
        </span>
      );
    },
  }),
  helper.display({
    id: "rpnl",
    header: "Realized P&L",
    // У открытой позиции реализованного PnL нет ни в одном чтении: он появляется
    // строкой леджера при расчёте и эпизодом в истории позиций. Ноль здесь
    // означал бы «сделок не было», что для позиции с историей ложь.
    cell: () => <span className="text-muted">{DASH}</span>,
  }),
  helper.display({
    id: "tpsl",
    header: "TP / SL",
    cell: (info) => {
      const { takeProfit, stopLoss } = info.row.original;
      return (
        <span className="flex flex-col leading-tight text-[11px]">
          <span className="text-long">
            {takeProfit === undefined ? DASH : fmtPrice(takeProfit)}
          </span>
          <span className="text-short">
            {stopLoss === undefined ? DASH : fmtPrice(stopLoss)}
          </span>
        </span>
      );
    },
  }),
]);

export function PositionsTable() {
  const { markets, allMarketIds } = useSelectedMarket();
  const {
    data: positions = EMPTY_POSITIONS,
    isLoading,
    isError,
  } = useEnrichedPositions(allMarketIds);
  const { data: prices } = usePricesQuery(allMarketIds);
  const { data: conditional = EMPTY_ORDERS } = useConditionalOrders();

  const rows = useMemo<PositionRow[]>(
    () =>
      positions.map((position) => {
        const key = position.marketId.toString();
        const triggers = conditional.filter((o) => o.marketId === key);
        const tp = triggers.find((o) => o.orderType.startsWith("TAKE_PROFIT"));
        const sl = triggers.find((o) => o.orderType.startsWith("STOP"));
        return {
          position,
          symbol: markets.find((m) => m.id === position.marketId)?.symbol ?? key,
          markPrice: prices?.[key]?.price,
          takeProfit: tp?.triggerPrice ? BigInt(tp.triggerPrice) : undefined,
          stopLoss: sl?.triggerPrice ? BigInt(sl.triggerPrice) : undefined,
        };
      }),
    [positions, conditional, markets, prices],
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      testid="positions-table"
      rowId={(r) => r.position.marketId.toString()}
      markets={markets.map((m) => ({ id: m.id.toString(), symbol: m.symbol }))}
      loading={isLoading}
      // Пустой ответ и провалившееся чтение — разные вещи: `useEnrichedPositions`
      // роняет запрос, когда ERC-7412 отревертил чтение по протухшему оракулу,
      // и «позиций нет» на этом месте было бы прямой ложью.
      notice={
        isError
          ? {
              testid: "positions-error",
              text: "Price feed is stale — positions unavailable.",
            }
          : null
      }
      emptyText="No open positions."
    />
  );
}

const EMPTY_POSITIONS: EnrichedPosition[] = [];
const EMPTY_ORDERS: GatewayOrder[] = [];
