/**
 * Что мок JSON-RPC (`mockChain.ts`) знает о контрактах: адреса и ABI — из того
 * же SDK, который он мокает, а своё здесь только диспетчеризация вызова по
 * адресу.
 *
 * Оба контура регистрируются нарочно. Приложение резолвит адреса через
 * `getDeployEnv()`, который в браузере читает отсутствующий
 * `process.env.DEPLOY_ENV` и сваливается на production; мок отвечает любому из
 * двух, чтобы не зависеть от этого. По той же причине `deployEnv` ниже передан
 * явно: возьми `getChainConfig` его из окружения — под `DEPLOY_ENV=staging`
 * оба набора совпали бы, production выпал бы из `classify`, и страница снова
 * зависла бы на «Loading account…».
 */
import { getChainConfig, MULTICALL3_ADDRESS, type ChainConfig } from "@liq/core";
import { erc20Abi, perpsAccountProxyAbi, perpsMarketProxyAbi } from "@liq/sdk";
import type { Abi } from "viem";

import { CHAIN_ID } from "./constants";

type LogicalContract = keyof ChainConfig["contracts"] | "multicall3" | "unknown";

/** Адрес (в нижнем регистре) → логический контракт, оба контура сразу. */
const BY_ADDRESS = new Map<string, LogicalContract>([
  [MULTICALL3_ADDRESS.toLowerCase(), "multicall3"],
  ...(["production", "staging"] as const).flatMap((env) =>
    Object.entries(getChainConfig(CHAIN_ID, env).contracts).map(
      ([name, address]) =>
        [address.toLowerCase(), name as LogicalContract] as const,
    ),
  ),
]);

export function classify(address: string): LogicalContract {
  return BY_ADDRESS.get(address.toLowerCase()) ?? "unknown";
}

/** Всё, кроме `aggregate3`, — для декодирования и кодирования одиночных вызовов. */
export const combinedAbi = [
  ...perpsAccountProxyAbi,
  ...perpsMarketProxyAbi,
  ...erc20Abi,
] as const satisfies Abi;
