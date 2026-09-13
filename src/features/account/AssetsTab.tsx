import { formatQty, formatUsd, getChainConfig, getCollaterals } from "@liq/core";
import {
  useCollateralAmountQuery,
  useDepositableBalance,
  useNetworkId,
} from "@liq/react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DASH } from "../../lib/format";
import { Panel } from "./AccountCards";
import { DepositDialog } from "./DepositDialog";
import { useCollateralBalances } from "./useCollateralBalances";
import { WithdrawDialog } from "./WithdrawDialog";

type Dialog = { kind: "deposit" | "withdraw"; symbol: string } | null;

/** Коллатералы контура строками; итог — из того же кеша, что и строки. */
export function AssetsTab() {
  const networkId = useNetworkId();
  const collaterals = getCollaterals(getChainConfig(networkId));
  const { totalWad } = useCollateralBalances();
  const [dialog, setDialog] = useState<Dialog>(null);

  return (
    <Panel className="flex flex-col gap-3" testid="assets-panel">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Assets</h2>
        <span className="text-xs text-muted">
          Total collateral:{" "}
          <span className="font-semibold text-text tabular-nums" data-testid="assets-total">
            {totalWad === undefined ? DASH : formatUsd(totalWad)}
          </span>
        </span>
      </div>
      <Table data-testid="assets-table" containerClassName="overflow-x-auto">
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead>In account</TableHead>
            <TableHead>In wallet</TableHead>
            <TableHead>USD value</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(collaterals).map(([symbol, c]) => (
            <AssetRow
              key={symbol}
              symbol={symbol}
              marketId={BigInt(c.marketId)}
              onDeposit={() => setDialog({ kind: "deposit", symbol })}
              onWithdraw={() => setDialog({ kind: "withdraw", symbol })}
            />
          ))}
        </TableBody>
      </Table>
      {/* `key` по токену: диалог читает initialSymbol один раз при монтировании. */}
      <DepositDialog
        key={`deposit-${dialog?.symbol ?? ""}`}
        open={dialog?.kind === "deposit"}
        initialSymbol={dialog?.symbol}
        onClose={() => setDialog(null)}
      />
      <WithdrawDialog
        key={`withdraw-${dialog?.symbol ?? ""}`}
        open={dialog?.kind === "withdraw"}
        initialSymbol={dialog?.symbol}
        onClose={() => setDialog(null)}
      />
    </Panel>
  );
}

function AssetRow({
  symbol,
  marketId,
  onDeposit,
  onWithdraw,
}: {
  symbol: string;
  marketId: bigint;
  onDeposit: () => void;
  onWithdraw: () => void;
}) {
  const { data: held } = useCollateralAmountQuery(marketId);
  const { data: wallet } = useDepositableBalance(symbol);
  return (
    <TableRow data-testid={`asset-row-${symbol}`}>
      <TableCell className="font-semibold">{symbol}</TableCell>
      <TableCell className="tabular-nums" data-testid={`asset-held-${symbol}`}>
        {held === undefined ? DASH : `${formatQty(held)} ${symbol}`}
      </TableCell>
      <TableCell className="tabular-nums">
        {wallet === undefined ? DASH : `${formatQty(wallet.total)} ${symbol}`}
      </TableCell>
      {/* Стейблы 1:1 к доллару — USD value равен остатку. */}
      <TableCell className="tabular-nums">
        {held === undefined ? DASH : formatUsd(held)}
      </TableCell>
      <TableCell className="text-right">
        <button
          type="button"
          onClick={onDeposit}
          aria-label={`Deposit ${symbol}`}
          data-testid={`asset-deposit-${symbol}`}
          className="mr-2 text-accent hover:brightness-110"
        >
          <ArrowDownToLine size={16} />
        </button>
        <button
          type="button"
          onClick={onWithdraw}
          aria-label={`Withdraw ${symbol}`}
          data-testid={`asset-withdraw-${symbol}`}
          className="text-muted hover:text-text"
        >
          <ArrowUpFromLine size={16} />
        </button>
      </TableCell>
    </TableRow>
  );
}
