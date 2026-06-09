import { getChainConfig, Margin } from "@liq/sdk";
import {
  liqQueryKeys,
  useAccountId,
  useLiqOnchain,
  useNetworkId,
  useRepay,
  useTransactionMutation,
  useWallet,
} from "@liq/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { fmtUsd } from "../../lib/format";

export function WithdrawDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const accountId = useAccountId();
  const onchain = useLiqOnchain();
  const networkId = useNetworkId();
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");

  // sUSDC collateral lives under the chain's sUSDC synth-market id (staging = 1,
  // prod = 3) — the same id DepositBuilder credits. Hardcoding 0 withdrew from an
  // empty collateral slot and reverted on-chain (#459). Resolved via the SDK
  // chain config (deploy env is wired through process.env.DEPLOY_ENV at build).
  const susdcCollateralId = BigInt(getChainConfig(networkId).susdcMarketId);

  // Synthetix blocks ALL collateral withdrawals while the account carries debt
  // (closed-at-loss); a plain withdraw would revert. Read it so we can offer an
  // atomic repay+withdraw instead. Best-effort: on error/loading the value is
  // `undefined`, which falls through to the normal withdraw path (so debt-free
  // or mocked accounts are unaffected).
  const debtKey = ["liq", "account", "debt", accountId?.toString() ?? ""];
  const { data: debt } = useQuery<bigint>({
    queryKey: debtKey,
    queryFn: () => onchain.collateral.debt(accountId!),
    enabled: open && accountId !== undefined,
    retry: false,
    staleTime: 10_000,
  });
  const hasDebt = debt !== undefined && debt > 0n;

  const withdraw = useTransactionMutation<
    `0x${string}`,
    { accountId: bigint; amount: string }
  >({
    transactionType: "WITHDRAW",
    // Parse INSIDE the mutation so a malformed amount rejects the mutation (→
    // `withdraw.error`, rendered below) instead of throwing uncaught in the
    // click handler. Symmetric with DepositDialog, which hands the raw string to
    // the SDK and lets it parse asynchronously.
    // modifyCollateral(accountId, collateralId, amountDelta); negative = withdraw.
    mutationFn: ({ accountId, amount }) =>
      onchain.deposit.modifyCollateral(
        accountId,
        susdcCollateralId,
        -Margin.parse(amount),
      ),
    invalidateKeys: wallet
      ? [{ queryKey: liqQueryKeys.account.margin(networkId, wallet) }]
      : [],
    onTransactionSuccess: () => {
      setAmount("");
      onClose();
    },
  });

  // Repay the debt and withdraw in a SINGLE transaction (RepayBuilder.thenWithdraw):
  // payDebt clears the gate in-batch, then the withdraw of `withdrawWei` succeeds.
  const repay = useRepay();

  const pending = withdraw.isPending || repay.isPending;
  const error = hasDebt ? repay.error : withdraw.error;

  // `mutate` (not `mutateAsync`): a failed op surfaces via the mutation's
  // `error` (rendered below); rejecting this handler would log an unhandled
  // promise rejection via the `void` click binding.
  function onSubmit() {
    if (accountId === undefined || !amount) return;
    if (hasDebt) {
      repay.mutate(
        { accountId, withdrawWei: Margin.parse(amount) },
        {
          onSuccess: () => {
            setAmount("");
            void queryClient.invalidateQueries({ queryKey: debtKey });
            onClose();
          },
        },
      );
    } else {
      withdraw.mutate({ accountId, amount });
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div data-testid="withdraw-dialog">
        <h3 className="mb-3 text-sm font-semibold">Withdraw sUSDC</h3>
        {hasDebt && (
          <div
            className="mb-3 rounded border border-short/40 bg-short/10 p-2 text-[11px] text-short"
            data-testid="withdraw-debt-notice"
          >
            ⚠ Account debt: {fmtUsd(debt ?? 0n)}. Withdrawals are blocked until
            repaid — this repays your debt (from wallet funds) and withdraws in
            one transaction.
          </div>
        )}
        <Input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100"
          data-testid="withdraw-amount-input"
        />
        {error && (
          <p
            className="mt-2 text-[11px] text-short"
            data-testid="withdraw-error"
          >
            {error.message}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={onClose}
            data-testid="withdraw-cancel-button"
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={pending || !amount || accountId === undefined}
            onClick={onSubmit}
            data-testid="withdraw-submit-button"
          >
            {pending
              ? hasDebt
                ? "Repaying…"
                : "Withdrawing…"
              : hasDebt
                ? "Repay & Withdraw"
                : "Withdraw"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
