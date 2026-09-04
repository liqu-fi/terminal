import { turnkeyConnector } from "@liq/turnkey";
import { defineChain } from "viem";
import { createConfig, http, type Config } from "wagmi";
import { injected } from "wagmi/connectors";

import { env, turnkeyLoginEnabled } from "./env";

export const megaethTestnet = defineChain({
  id: 6343,
  name: "MegaETH Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [env.rpcUrl] } },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://megaeth-testnet-v2.blockscout.com",
    },
  },
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
  testnet: true,
});

/**
 * @remarks
 * Две двери — два коннектора, и порядок в списке значения не имеет: и
 * `ConnectButton`, и восстановление сессии ищут коннектор ПО ID
 * (`reconnectPlan`), а не по индексу. Раньше кнопка брала `connectors[0]` и
 * работала лишь потому, что коннектор был ровно один.
 *
 * `multiInjectedProviderDiscovery: false` — не оптимизация. По умолчанию wagmi
 * добавляет коннектор на КАЖДЫЙ кошелёк, объявившийся по EIP-6963 (MetaMask,
 * Rabby, Phantom, TronLink…), и «первый авторизованный» в `reconnect()`
 * становится лотереей, в которой встроенный кошелёк Turnkey заведомо
 * проигрывает — его провайдер на старте ещё пуст. Выключенным флагом wagmi
 * заодно перестаёт опрашивать `eth_accounts` у каждого расширения на загрузке.
 *
 * Коннектора `walletConnect()` здесь по-прежнему нет: стек WalletConnect
 * принадлежит `TurnkeyProviderWrapper` на том же project id, а две Core на
 * странице делят clientId через localStorage и дерутся за единственное
 * разрешённое каждой соединение с релеем. Коннектор wagmi к тому же определяет
 * `setup()`, который жадно поднимает `EthereumProvider.init()` во время
 * `createConfig()` — сокет к релею открывался на каждой загрузке страницы даже
 * тем, кто кошелька не касался.
 */
export function getConfig(): Config {
  return createConfig({
    chains: [megaethTestnet],
    connectors: turnkeyLoginEnabled
      ? [injected(), turnkeyConnector()]
      : [injected()],
    multiInjectedProviderDiscovery: false,
    transports: { [megaethTestnet.id]: http(env.rpcUrl) },
  });
}
