import {
  useAccountId,
  useDepositMutation,
  useDepositableBalance,
} from "@liq/react";

import {
  CollateralAmountDialog,
  useCollateralSymbol,
} from "./CollateralAmountDialog";

export function DepositDialog({
  open,
  onClose,
  initialSymbol,
}: {
  open: boolean;
  onClose: () => void;
  /** Токен, с которого открывается диалог (строка Assets); иначе — первый контура. */
  initialSymbol?: string;
}) {
  const accountId = useAccountId();
  const { symbols, symbol, setSymbol, collateral } =
    useCollateralSymbol(initialSymbol);
  // Отправителя выбирает провайдер — проп `relay` в LiqSetup (ADR-0063).
  // Под ним весь депозит едет одним подписанным батчем; кошельковый путь
  // послал бы прямой approve отдельной транзакцией — как группировать план,
  // решает отправитель, а не билдер.
  const deposit = useDepositMutation();

  // Wallet balance of the token this deposit actually spends (lifted to WAD) —
  // gating on the synth here would show $0.00 and block every deposit for a
  // fresh faucet user who holds the token and none of its synth. Best-effort:
  // an unavailable read resolves to 0n → no Max, no cap.
  const { data } = useDepositableBalance(symbol);

  return (
    <CollateralAmountDialog
      open={open}
      onClose={onClose}
      testIdPrefix="deposit"
      title={`Deposit ${symbol}`}
      symbols={symbols}
      symbol={symbol}
      onSymbolChange={setSymbol}
      decimals={collateral.decimals}
      limit={data?.token}
      limitLabel="Wallet balance"
      exceededText="Exceeds wallet balance."
      submitLabel="Deposit"
      pendingLabel="Depositing…"
      pending={deposit.isPending}
      error={deposit.error}
      disabled={accountId === undefined}
      onSubmit={({ amount }, onSuccess) => {
        if (accountId === undefined) return;
        deposit.mutate(
          { amount, accountId, collateral: symbol },
          { onSuccess, onError: () => {} },
        );
      }}
    />
  );
}
