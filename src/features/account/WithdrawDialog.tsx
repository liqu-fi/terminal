import { Margin } from "@liq/sdk";
import {
  liqQueryKeys,
  useAccountId,
  useLiqOnchain,
  useNetworkId,
  useTransactionMutation,
  useWallet,
} from "@liq/react";
import { useState } from "react";

import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";

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
  const [amount, setAmount] = useState("");

  const withdraw = useTransactionMutation<
    `0x${string}`,
    { accountId: bigint; amount: string }
  >({
    transactionType: "WITHDRAW",
    // Parse INSIDE the mutation so a malformed amount rejects the mutation (→
    // `withdraw.error`, rendered below) instead of throwing uncaught in the
    // click handler. Symmetric with DepositDialog, which hands the raw string to
    // the SDK and lets it parse asynchronously.
    // modifyCollateral(accountId, collateralId, amountDelta)
    // collateralId = 0n (sUSDC synth market id 0)
    // amountDelta negative = withdraw
    mutationFn: ({ accountId, amount }) =>
      onchain.deposit.modifyCollateral(accountId, 0n, -Margin.parse(amount)),
    invalidateKeys: wallet
      ? [{ queryKey: liqQueryKeys.account.margin(networkId, wallet) }]
      : [],
    onTransactionSuccess: () => {
      setAmount("");
      onClose();
    },
  });

  // `mutate` (not `mutateAsync`): a failed withdraw surfaces via the mutation's
  // `error` (rendered below) and `onTransactionError`; rejecting this handler
  // would log an unhandled promise rejection via the `void onWithdraw()` call.
  function onWithdraw() {
    if (accountId === undefined || !amount) return;
    withdraw.mutate({ accountId, amount });
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div data-testid="withdraw-dialog">
        <h3 className="mb-3 text-sm font-semibold">Withdraw sUSDC</h3>
        <Input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100"
          data-testid="withdraw-amount-input"
        />
        {withdraw.error && (
          <p className="mt-2 text-[11px] text-short" data-testid="withdraw-error">
            {withdraw.error.message}
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
            disabled={withdraw.isPending || !amount || accountId === undefined}
            onClick={onWithdraw}
            data-testid="withdraw-submit-button"
          >
            {withdraw.isPending ? "Withdrawing…" : "Withdraw"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
