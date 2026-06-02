import { useAccountId, useDepositMutation } from "@liqcx/liq-react";
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
      <h3 className="mb-3 text-sm font-semibold">Deposit USDC</h3>
      <Input
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="100"
      />
      {deposit.error && (
        <p className="mt-2 text-[11px] text-short">{deposit.error.message}</p>
      )}
      <div className="mt-3 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={deposit.isPending || !amount || accountId === undefined}
          onClick={() => void onDeposit()}
        >
          {deposit.isPending ? "Depositing…" : "Deposit"}
        </Button>
      </div>
    </Dialog>
  );
}
