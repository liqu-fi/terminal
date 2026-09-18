/**
 * Self-contained on-chain reads for live (Tier 2) preconditions. Used to gate a
 * test on real account state — e.g. whether the account can actually withdraw —
 * instead of discovering it via a 180s UI hang on a reverting transaction.
 *
 * Адреса и ABI — из SDK, а не из мока Tier 1: устаревший здесь адрес отвечает
 * на живом контуре чужого развёртывания, и предусловие тихо мерит не тот
 * аккаунт.
 */
import {
  getContractAddress,
  perpsAccountProxyAbi,
  perpsMarketProxyAbi,
} from "@liq/sdk";
import { createPublicClient, defineChain, http } from "viem";
import { mnemonicToAccount } from "viem/accounts";

import { liveEnv } from "./env";

function publicClient() {
  const chain = defineChain({
    id: liveEnv.chainId,
    name: "MegaETH Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [liveEnv.rpcUrl] } },
    testnet: true,
  });
  return createPublicClient({ chain, transport: http(liveEnv.rpcUrl) });
}

/**
 * Outstanding Synthetix debt (USD, 18-dec) of the test wallet's first SNX
 * account, or `null` if it owns no account yet. Debt accrues when a position
 * closes at a loss; while it is non-zero the protocol blocks ALL collateral
 * withdrawals (even of a fresh deposit), so a deposit→withdraw round-trip
 * cannot complete until a repay step the reference terminal doesn't implement.
 */
export async function readAccountDebt(
  walletIndex = 0,
): Promise<bigint | null> {
  const pub = publicClient();
  const owner = mnemonicToAccount(liveEnv.mnemonic, {
    addressIndex: walletIndex,
  }).address;
  const accountProxy = getContractAddress(
    liveEnv.chainId,
    "PerpsAccountProxy",
    liveEnv.deployEnv,
  );
  const count = await pub.readContract({
    address: accountProxy,
    abi: perpsAccountProxyAbi,
    functionName: "balanceOf",
    args: [owner],
  });
  if (count === 0n) return null;
  const accountId = await pub.readContract({
    address: accountProxy,
    abi: perpsAccountProxyAbi,
    functionName: "tokenOfOwnerByIndex",
    args: [owner, 0n],
  });
  return pub.readContract({
    address: getContractAddress(
      liveEnv.chainId,
      "PerpsMarketProxy",
      liveEnv.deployEnv,
    ),
    abi: perpsMarketProxyAbi,
    functionName: "debt",
    args: [accountId],
  });
}
