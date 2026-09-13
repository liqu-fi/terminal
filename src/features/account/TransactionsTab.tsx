import type { PortfolioPeriod } from "@liq/api-client";
import { truncateAddress } from "@liq/core";
import {
  useAccountId,
  usePortfolioQuery,
  useSettlementLedgerQuery,
} from "@liq/react";
import { createColumnHelper } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable, MARKET_COLUMN_ID } from "@/components/data-table/DataTable";
import { features, marketFilterFn } from "@/components/data-table/features";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { DASH, fmtSignedUsdNum, fmtTime } from "../../lib/format";
import { marketSymbol, useSelectedMarket } from "../market/useSelectedMarket";
import { Panel, PeriodSelect } from "./AccountCards";
import {
  ACTIVITY_LABEL,
  activityCsv,
  activityRows,
  filterActivity,
  LEDGER_PAGE,
  periodWindow,
  withinWindow,
  type ActivityKind,
  type ActivityRow,
} from "./accountLogic";

type Kind = ActivityKind | "all";
const KINDS: readonly Kind[] = ["all", "deposit", "withdrawal", "trade", "liquidation"];
const KIND_LABEL: Record<Kind, string> = {
  all: "All types",
  deposit: "Deposits",
  withdrawal: "Withdrawals",
  trade: "Trades",
  liquidation: "Liquidations",
};

interface Row {
  row: ActivityRow;
  /** Символ рынка; пустая строка у депозитов и выводов. */
  symbol: string;
  /**
   * Ключ строки таблицы. `row.id` (`type-timestamp-collateralId-amountUsd`)
   * может совпасть у двух одинаковых по секунде депозитов — индекс в общем
   * списке различает их без изменений в `accountLogic.ts`.
   */
  key: string;
}

const helper = createColumnHelper<typeof features, Row>();

const columns = helper.columns([
  helper.accessor((r) => r.row.timestampMs, {
    id: "time",
    header: "Time",
    cell: (info) => <span className="text-muted">{fmtTime(info.getValue())}</span>,
  }),
  helper.accessor((r) => r.row.kind, {
    id: "type",
    header: "Type",
    cell: (info) => (
      <span className={info.getValue() === "liquidation" ? "text-short" : undefined}>
        {ACTIVITY_LABEL[info.getValue()]}
      </span>
    ),
  }),
  helper.accessor((r) => r.symbol, {
    id: MARKET_COLUMN_ID,
    header: "Market",
    enableHiding: false,
    // Депозиты рынка не имеют: при выбранном рынке они скрываются, при «все» — видны.
    filterFn: (row, _id, value) =>
      marketFilterFn(row.original.row.marketId?.toString() ?? "", value),
    cell: (info) =>
      info.getValue() ? (
        <span className="font-semibold">{info.getValue()}</span>
      ) : (
        <span className="text-muted">{DASH}</span>
      ),
  }),
  helper.accessor((r) => r.row.amountUsd ?? 0, {
    id: "amount",
    header: "Amount",
    cell: (info) => {
      const v = info.row.original.row.amountUsd;
      if (v === null) return <span className="text-muted">{DASH}</span>;
      return (
        <span className={v < 0 ? "text-short" : "text-long"}>{fmtSignedUsdNum(v)}</span>
      );
    },
  }),
  helper.accessor((r) => r.row.txHash ?? "", {
    id: "tx",
    header: "Tx",
    cell: (info) => (
      <span className="text-muted">
        {info.getValue() ? truncateAddress(info.getValue()) : DASH}
      </span>
    ),
  }),
]);

export function TransactionsTab() {
  const accountId = useAccountId();
  const { markets } = useSelectedMarket();
  const [period, setPeriod] = useState<PortfolioPeriod>("30d");
  const [now, setNow] = useState(() => Date.now());
  const [kind, setKind] = useState<Kind>("all");
  const range = useMemo(() => periodWindow(period, now), [period, now]);

  const {
    data: portfolio,
    isPending: portfolioPending,
    isError: portfolioFailed,
  } = usePortfolioQuery(accountId, period);
  const {
    data: ledger,
    isPending: ledgerPending,
    isError: ledgerFailed,
  } = useSettlementLedgerQuery(accountId, { ...range, limit: LEDGER_PAGE });

  // Три состояния запроса, не два (ruling после задачи 5): пока хоть один из
  // двух источников не осел — ничего не утверждаем; провал/`available: false`
  // — отдельная строка, а не пустая таблица; «пусто» — только когда оба
  // источника отдали ответ и он говорит именно это.
  const pending = portfolioPending || ledgerPending;
  const unavailable = portfolio?.available === false || portfolioFailed || ledgerFailed;

  const rows = useMemo<Row[]>(() => {
    if (pending || unavailable) return [];
    const events = portfolio?.available ? portfolio.collateralEvents : [];
    const all = withinWindow(activityRows(events, ledger?.rows ?? []), range);
    return filterActivity(all, kind).map((row, i) => ({
      row,
      symbol: row.marketId === undefined ? "" : marketSymbol(markets, row.marketId),
      key: `${row.id}-${i}`,
    }));
  }, [pending, unavailable, portfolio, ledger, range, kind, markets]);

  function exportCsv() {
    const csv = activityCsv(
      rows.map((r) => r.row),
      (id) => marketSymbol(markets, id),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `account-transactions-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Panel className="flex min-h-[420px] flex-col gap-3" testid="transactions-panel">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Transactions</h2>
        <div className="flex-1" />
        <Select value={kind} onValueChange={(next) => setKind(next as Kind)}>
          <SelectTrigger size="sm" className="h-7 text-xs" data-testid="transactions-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => (
              <SelectItem key={k} value={k} data-testid={`transactions-type-${k}`}>
                {KIND_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <PeriodSelect
          value={period}
          onChange={(next) => {
            setPeriod(next);
            setNow(Date.now());
          }}
          testid="transactions-period"
        />
        <Button
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={exportCsv}
          disabled={rows.length === 0}
          data-testid="transactions-export"
        >
          <Download size={14} /> CSV
        </Button>
      </div>
      <DataTable
        data={rows}
        columns={columns}
        testid="transactions-table"
        rowId={(r) => r.key}
        loading={pending}
        notice={
          unavailable
            ? {
                testid: "transactions-unavailable",
                text: "Transaction history is unavailable on this gateway",
              }
            : null
        }
        emptyText="No transactions in this period."
      />
    </Panel>
  );
}
