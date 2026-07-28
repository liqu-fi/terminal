import { defineChain } from "viem";
import { createConfig, http, type Config } from "wagmi";
import { injected } from "wagmi/connectors";

import { env } from "./env";

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
 * Deliberately `injected()` only — no `walletConnect()` connector here.
 * `TurnkeyProviderWrapper` (see `providers/LiqSetup.tsx`) already owns a
 * WalletConnect stack on the same `VITE_WALLETCONNECT_PROJECT_ID`, and two Cores
 * in one page share a clientId via localStorage, so they fight over the single
 * relay connection each is allowed. wagmi's WalletConnect connector also defines
 * `setup()`, which eagerly runs `EthereumProvider.init()` at `createConfig()`
 * time — that opened a relay socket on every page load even for visitors who
 * never touched a wallet. Turnkey is the one WalletConnect owner.
 */
export function getConfig(): Config {
  return createConfig({
    chains: [megaethTestnet],
    connectors: [injected()],
    transports: { [megaethTestnet.id]: http(env.rpcUrl) },
  });
}
