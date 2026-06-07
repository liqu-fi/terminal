/**
 * Gas funding for live specs: a small native-ETH transfer from the pool wallet
 * (derivation index 0) to a freshly derived address. The staging faucet only
 * dispenses fUSDC — gas has to come from the pool.
 */
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";

import { liveEnv } from "./env";

export async function fundGas(to: `0x${string}`, eth: string): Promise<void> {
  const chain = defineChain({
    id: liveEnv.chainId,
    name: "MegaETH Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [liveEnv.rpcUrl] } },
    testnet: true,
  });
  const funder = mnemonicToAccount(liveEnv.mnemonic, { addressIndex: 0 });
  const wallet = createWalletClient({
    account: funder,
    chain,
    transport: http(liveEnv.rpcUrl),
  });
  const pub = createPublicClient({ chain, transport: http(liveEnv.rpcUrl) });
  const hash = await wallet.sendTransaction({ to, value: parseEther(eth) });
  await pub.waitForTransactionReceipt({ hash });
}
