import { buildMarketOrderMessage, OrderType, type Side } from "@liq/core";
import { signOrder } from "@liq/onchain";
import {
  liqQueryKeys,
  useLiqClient,
  useSessionKey,
  useSessionKeyManager,
  withNonceRetry,
} from "@liq/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useChainId, useWalletClient } from "wagmi";

import { env } from "../../../config/env";

export interface SubmitMarketOrderInput {
  accountId: bigint;
  marketId: bigint;
  sizeDelta: bigint;
  side: Side;
  acceptablePrice: bigint;
}

/**
 * Submit a market order — signs via the Turnkey session key when one is active
 * (no wallet popup), else via the wagmi wallet.
 *
 * @remarks
 * Terminal-local copy of the SDK's `useSubmitMarketOrder` (which binds the
 * wagmi wallet internally and exposes no session seam). The only change is the
 * signer selection: `signOrder` is polymorphic over `WalletClient |
 * ISessionSigner`. With no active session, `signer === walletClient` →
 * byte-identical to the SDK hook (same message, signature path, and submit body).
 */
export function useSubmitMarketOrder() {
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const client = useLiqClient();
  const queryClient = useQueryClient();
  const manager = useSessionKeyManager({ config: env.turnkey });
  const { isActive } = useSessionKey(manager);

  return useMutation({
    mutationFn: async (input: SubmitMarketOrderInput) => {
      const signer = isActive && manager ? manager : walletClient;
      if (!signer) throw new Error("Wallet not connected");

      return withNonceRetry(async (nonce) => {
        const message = buildMarketOrderMessage({
          accountId: input.accountId,
          marketId: input.marketId,
          sizeDelta: input.sizeDelta,
          acceptablePrice: input.acceptablePrice,
          nonce,
        });

        const signature = await signOrder(signer, message, chainId);

        return client.orders.submit({
          accountId: input.accountId.toString(),
          marketId: input.marketId.toString(),
          sizeDelta: input.sizeDelta.toString(),
          side: input.side,
          orderType: OrderType.MARKET,
          signature,
          nonce: message.nonce,
          expiry: Number(message.expiry),
          acceptablePrice: message.acceptablePrice,
          poolExecution: true,
          chainId,
        });
      });
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({
        queryKey: liqQueryKeys.orders.open(input.accountId.toString()),
      });
    },
  });
}
