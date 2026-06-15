import {
  buildLimitOrderMessage,
  OrderType,
  type Side,
  type TimeInForce,
} from "@liq/core";
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

export interface SubmitLimitOrderInput {
  accountId: bigint;
  marketId: bigint;
  sizeDelta: bigint;
  side: Side;
  limitPrice: bigint;
  acceptablePrice: bigint;
  timeInForce?: TimeInForce;
}

/**
 * Submit a limit order — signs via the Turnkey session key when active, else
 * via the wagmi wallet. Terminal-local copy of the SDK hook + signer selection
 * (see {@link useSubmitMarketOrder}). Flag-off ⇒ byte-identical to the SDK hook.
 */
export function useSubmitLimitOrder() {
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const client = useLiqClient();
  const queryClient = useQueryClient();
  const manager = useSessionKeyManager({ config: env.turnkey });
  const { isActive } = useSessionKey(manager);

  return useMutation({
    mutationFn: async (input: SubmitLimitOrderInput) => {
      const signer = isActive && manager ? manager : walletClient;
      if (!signer) throw new Error("Wallet not connected");

      return withNonceRetry(async (nonce) => {
        const message = buildLimitOrderMessage({
          accountId: input.accountId,
          marketId: input.marketId,
          sizeDelta: input.sizeDelta,
          limitPrice: input.limitPrice,
          nonce,
        });

        const signature = await signOrder(signer, message, chainId);

        return client.orders.submit({
          accountId: input.accountId.toString(),
          marketId: input.marketId.toString(),
          sizeDelta: input.sizeDelta.toString(),
          side: input.side,
          orderType: OrderType.LIMIT,
          signature,
          nonce: message.nonce,
          expiry: Number(message.expiry),
          limitPrice: message.limitPrice,
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
