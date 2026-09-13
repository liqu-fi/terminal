import { getChainConfig, getCollaterals } from "@liq/core";
import {
  useAccountId,
  useLiqOnchain,
  useLiqQueryKeys,
  useNetworkId,
  useWallet,
} from "@liq/react";
import { useQueries } from "@tanstack/react-query";

import { sumWhenAllLoaded } from "./accountLogic";

export interface CollateralBalance {
  symbol: string;
  marketId: bigint;
  /** WAD; `undefined` — ещё не прочитано. */
  amount: bigint | undefined;
}

/**
 * Остатки всех коллатералов контура для итога «Total collateral» и карточки
 * Assets на Overview.
 *
 * @remarks Ключи и `queryFn` — те же, что у `useCollateralAmountQuery` SDK
 * (`keys.account.collateral(wallet, id)` + `onchain.collateral.collateralAmount`):
 * одна запись кеша на токен, строки таблицы Assets и итог не расходятся.
 * Список токенов статичен для сети, поэтому число запросов между рендерами не
 * меняется.
 */
export function useCollateralBalances(): {
  balances: CollateralBalance[];
  totalWad: bigint | undefined;
} {
  const networkId = useNetworkId();
  const onchain = useLiqOnchain();
  const keys = useLiqQueryKeys();
  const wallet = useWallet();
  const accountId = useAccountId();
  const entries = Object.entries(getCollaterals(getChainConfig(networkId)));

  const results = useQueries({
    queries: entries.map(([, c]) => ({
      queryKey: keys.account.collateral(wallet ?? "", String(c.marketId)),
      queryFn: () =>
        onchain.collateral.collateralAmount(accountId!, BigInt(c.marketId)),
      enabled: accountId !== undefined && wallet !== null,
      staleTime: 5_000,
    })),
  });

  const balances = entries.map<CollateralBalance>(([symbol, c], i) => ({
    symbol,
    marketId: BigInt(c.marketId),
    amount: results[i].data,
  }));
  const totalWad = sumWhenAllLoaded(balances.map((b) => b.amount));
  return { balances, totalWad };
}
