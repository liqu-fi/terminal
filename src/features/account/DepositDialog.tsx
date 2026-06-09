import { getChainConfig, Margin } from "@liq/sdk";
import {
  useAccountId,
  useBalancesQuery,
  useDepositMutation,
  useNetworkId,
} from "@liq/react";
import type { Address } from "viem";
import { useState } from "react";

import { Button } from "../../components/ui/Button";
import { DecimalInput } from "../../components/ui/DecimalInput";
import { Dialog } from "../../components/ui/Dialog";
import { fmtUsd, wadToFixed } from "../../lib/format";

/** PerpsMarketProxy (the deposit spender), or undefined on an unknown chain. */
function depositSpender(networkId: number): Address | undefined {
  try {
    return getChainConfig(networkId).contracts.PerpsMarketProxy;
  } catch {
    return undefined;
  }
}

function parseAmount(amount: string): bigint {
  if (!amount) return 0n;
  try {
    return Margin.parse(amount);
  } catch {
    return 0n;
  }
}

export function DepositDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const accountId = useAccountId();
  const networkId = useNetworkId();
  const deposit = useDepositMutation();
  const [amount, setAmount] = useState("");

  // Wallet sUSDC balance, read against the PerpsMarketProxy spender (the
  // contract `modifyCollateral` pulls from). Best-effort: an unavailable read
  // (e.g. unmocked chain) leaves `balance` undefined → no Max, no cap.
  const spender = depositSpender(networkId);
  const { data: balances } = useBalancesQuery(spender ? [spender] : []);
  const balance = balances?.balance;

  const amountWad = parseAmount(amount);
  const exceedsBalance = balance !== undefined && amountWad > balance;
  const invalid = exceedsBalance;

  // `mutate` (not `mutateAsync`): a failed deposit must surface via the
  // mutation's `error` (rendered below), not reject this handler — a rejected
  // `void onDeposit()` would otherwise log an unhandled promise rejection.
  function onDeposit() {
    if (accountId === undefined || amountWad <= 0n || invalid) return;
    deposit.mutate(
      { amount, accountId },
      {
        onSuccess: () => {
          setAmount("");
          onClose();
        },
        // An explicit error handler keeps a reverted deposit from becoming an
        // unhandled rejection. The SDK does not surface the revert as
        // `deposit.error` (liqcx/monorepo#434) — the error-UI fix needs the SDK.
        onError: () => {},
      },
    );
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div data-testid="deposit-dialog">
        <h3 className="mb-3 text-sm font-semibold">Deposit USDC</h3>
        {balance !== undefined && (
          <div className="mb-1 flex justify-between text-[11px] text-muted">
            <span>Wallet balance</span>
            <span className="text-text" data-testid="deposit-balance">
              {fmtUsd(balance)}
            </span>
          </div>
        )}
        <DecimalInput
          value={amount}
          onValueChange={setAmount}
          maxDecimals={6}
          invalid={invalid}
          placeholder="100"
          data-testid="deposit-amount-input"
          rightSlot={
            balance !== undefined && balance > 0n ? (
              <button
                type="button"
                onClick={() => setAmount(wadToFixed(balance, 2))}
                className="rounded-[var(--radius-sm)] bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-accent hover:brightness-110"
                data-testid="deposit-max-button"
              >
                MAX
              </button>
            ) : undefined
          }
        />
        {exceedsBalance && (
          <p
            className="mt-1 text-[10px] text-short"
            data-testid="deposit-validation"
          >
            Exceeds wallet balance.
          </p>
        )}
        {deposit.error && (
          <p className="mt-2 text-[11px] text-short" data-testid="deposit-error">
            {deposit.error.message}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={onClose}
            data-testid="deposit-cancel-button"
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={
              deposit.isPending ||
              amountWad <= 0n ||
              accountId === undefined ||
              invalid
            }
            onClick={onDeposit}
            data-testid="deposit-submit-button"
          >
            {deposit.isPending ? "Depositing…" : "Deposit"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
