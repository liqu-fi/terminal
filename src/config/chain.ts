import { defineChain } from "viem";
import { createConfig, http, type Config } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";

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

export function getConfig(): Config {
  const connectors = env.walletConnectId
    ? [injected(), walletConnect({ projectId: env.walletConnectId })]
    : [injected()];
  return createConfig({
    chains: [megaethTestnet],
    connectors,
    transports: { [megaethTestnet.id]: http(env.rpcUrl) },
  });
}
