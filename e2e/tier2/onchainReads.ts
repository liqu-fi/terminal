/**
 * Self-contained on-chain reads for live (Tier 2) preconditions. Used to gate a
 * test on real account state — e.g. whether the account can actually withdraw —
 * instead of discovering it via a 180s UI hang on a reverting transaction.
 *
 * ABIs are inlined (not imported from the Tier 1 mock's `contracts.ts`) so this
 * stays a pure Tier 2 concern; only the address book is shared.
 */
import { createPublicClient, defineChain, http } from "viem";
import { mnemonicToAccount } from "viem/accounts";

import { ADDR } from "../support/contracts";
import { liveEnv } from "./env";

const accountProxyAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "tokenOfOwnerByIndex",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const marketProxyAbi = [
  {
    name: "debt",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "accountId", type: "uint128" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** ADDR.* arrays are `[production, staging]` (see e2e/support/contracts.ts). */
function deployAddr(pair: readonly string[]): `0x${string}` {
  return (liveEnv.deployEnv === "production" ? pair[0] : pair[1]) as `0x${string}`;
}

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
  const accountProxy = deployAddr(ADDR.perpsAccountProxy);
  const count = await pub.readContract({
    address: accountProxy,
    abi: accountProxyAbi,
    functionName: "balanceOf",
    args: [owner],
  });
  if (count === 0n) return null;
  const accountId = await pub.readContract({
    address: accountProxy,
    abi: accountProxyAbi,
    functionName: "tokenOfOwnerByIndex",
    args: [owner, 0n],
  });
  return pub.readContract({
    address: deployAddr(ADDR.perpsMarketProxy),
    abi: marketProxyAbi,
    functionName: "debt",
    args: [accountId],
  });
}
