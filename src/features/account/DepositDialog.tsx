import { useAccountId, useDepositMutation } from "@liq/react";
import { useState } from "react";

import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";

export function DepositDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const accountId = useAccountId();
  const deposit = useDepositMutation();
  const [amount, setAmount] = useState("");

  async function onDeposit() {
    if (accountId === undefined || !amount) return;
    await deposit.mutateAsync({ amount, accountId });
    setAmount("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div data-testid="deposit-dialog">
        <h3 className="mb-3 text-sm font-semibold">Deposit USDC</h3>
        <Input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100"
          data-testid="deposit-amount-input"
        />
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
            disabled={deposit.isPending || !amount || accountId === undefined}
            onClick={() => void onDeposit()}
            data-testid="deposit-submit-button"
          >
            {deposit.isPending ? "Depositing…" : "Deposit"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
