import { useState } from "react";

import { Card } from "@/components/ui/card";

import { DASH, fmtSignedUsd, fmtUsd, toNum } from "../../lib/format";
import { DepositDialog } from "./DepositDialog";
import { useAccountSummary } from "./useAccountSummary";
import { WithdrawDialog } from "./WithdrawDialog";

export function AccountPanel() {
  const { summary } = useAccountSummary();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  return (
    <Card className="flex flex-col gap-2 p-3" data-testid="account-panel">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Account</span>
        <span className="flex gap-2">
          <button
            type="button"
            className="rounded-sm border px-2 py-0.5 text-[11px] text-accent"
            onClick={() => setDepositOpen(true)}
            data-testid="account-deposit-button"
          >
            Deposit
          </button>
          <button
            type="button"
            className="rounded-sm border px-2 py-0.5 text-[11px] text-muted"
            onClick={() => setWithdrawOpen(true)}
            data-testid="account-withdraw-button"
          >
            Withdraw
          </button>
        </span>
      </div>

      <Row
        label="Unrealized PnL"
        testid="account-unrealized-pnl"
        tone={summary.unrealizedPnl < 0n ? "text-short" : "text-long"}
        value={fmtSignedUsd(summary.unrealizedPnl)}
      />
      <Row
        label="Account Value"
        testid="account-value"
        value={
          summary.accountValue === undefined
            ? DASH
            : fmtUsd(summary.accountValue)
        }
      />
      <Row
        label="Equity"
        testid="account-equity"
        value={summary.equity === undefined ? DASH : fmtUsd(summary.equity)}
      />
      <Row
        label="Borrowed"
        testid="account-borrowed"
        value={fmtUsd(summary.borrowed)}
      />
      <Row
        label="Exposure"
        testid="account-exposure"
        value={fmtUsd(summary.exposure)}
      />
      <Row
        label="Account Leverage"
        testid="account-leverage"
        value={
          summary.leverage === undefined
            ? DASH
            : toNum(summary.leverage).toFixed(2)
        }
      />

      <DepositDialog open={depositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawDialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
      />
    </Card>
  );
}

function Row({
  label,
  value,
  testid,
  tone,
}: {
  label: string;
  value: string;
  testid: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={tone ?? "text-text"} data-testid={testid}>
        {value}
      </span>
    </div>
  );
}
