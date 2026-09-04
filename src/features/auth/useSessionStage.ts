import {
  selectIsAuthenticated,
  useAccountQuery,
  useGatewayStore,
  useWallet,
} from "@liq/react";
import { useAccount } from "wagmi";

import { env } from "../../config/env";
import { sessionStage, type SessionStage } from "./sessionStage";

/**
 * Ступень сессии — одним значением, для всех, кому она нужна.
 *
 * @remarks
 * Локальная, а не `useSessionStage` из `@liq/react`: та берёт сеть из
 * конфигурации `LiqProvider`, здесь же сравнение идёт с `env.chainId`, и переезд
 * на неё — отдельная уборка, не входящая в эту задачу.
 *
 * Рассинхрон ловится по КОННЕКТОРУ (`useAccount().chainId`), а не по
 * `useChainId()`: последний отдаёт сеть из конфига wagmi (6343) даже когда
 * кошелёк стоит на ненастроенной сети, и рассинхрона попросту не видит.
 */
export function useSessionStageLocal(): SessionStage {
  const wallet = useWallet();
  // Флаг загрузки, а не только `useAccountId()`: последний схлопывает «ещё
  // грузится» и «аккаунта нет» в один `undefined`, и экран мигал бы кнопкой
  // создания аккаунта до ответа ончейн-запроса.
  const { data: accountIds, isLoading: accountsLoading } = useAccountQuery();
  const isAuthenticated = useGatewayStore(selectIsAuthenticated);
  const account = useAccount();
  return sessionStage({
    wallet,
    wrongChain: account.isConnected && account.chainId !== env.chainId,
    accountId: accountIds?.[0],
    accountsLoading,
    isAuthenticated,
  });
}
