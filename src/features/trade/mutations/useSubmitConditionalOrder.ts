import {
  buildConditionalOrderMessage,
  type OrderType,
  type Side,
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

export interface SubmitConditionalOrderInput {
  accountId: bigint;
  marketId: bigint;
  sizeDelta: bigint;
  side: Side;
  orderType: "TAKE_PROFIT_MARKET" | "STOP_MARKET";
  triggerPrice: bigint;
  /** Whether trigger fires when price goes above triggerPrice (stop-buy, TP-sell). */
  triggerAbove: boolean;
  /** Reduce-only: triggered order may only close the position (attached TP/SL). */
  reduceOnly?: boolean;
}

/**
 * Submit a conditional order (TP/SL/Stop) — signs via the Turnkey session key
 * when active, else via the wagmi wallet. Terminal-local copy of the SDK hook +
 * signer selection (see {@link useSubmitMarketOrder}). Flag-off ⇒ byte-identical.
 */
export function useSubmitConditionalOrder() {
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const client = useLiqClient();
  const queryClient = useQueryClient();
  const manager = useSessionKeyManager({ config: env.turnkey });
  const { isActive } = useSessionKey(manager);

  return useMutation({
    mutationFn: async (input: SubmitConditionalOrderInput) => {
      const signer = isActive && manager ? manager : walletClient;
      if (!signer) throw new Error("Wallet not connected");

      return withNonceRetry(async (nonce) => {
        const message = buildConditionalOrderMessage({
          accountId: input.accountId,
          marketId: input.marketId,
          sizeDelta: input.sizeDelta,
          triggerPrice: input.triggerPrice,
          triggerAbove: input.triggerAbove,
          orderType: input.orderType,
          reduceOnly: input.reduceOnly,
          nonce,
        });

        const signature = await signOrder(signer, message, chainId);

        return client.orders.submit({
          accountId: input.accountId.toString(),
          marketId: input.marketId.toString(),
          sizeDelta: input.sizeDelta.toString(),
          side: input.side,
          orderType: input.orderType as OrderType,
          signature,
          nonce: message.nonce,
          expiry: Number(message.expiry),
          triggerPrice: message.triggerPrice,
          // `triggerAbove` is part of the signed EIP-712 struct (#449) — the
          // gateway rebuilds the message to verify the signature and defaults a
          // missing field to `false`, recovering a different signer. Must send it.
          triggerAbove: message.triggerAbove,
          // Mirror the signed message: a mismatched reduceOnly recovers a
          // different signer at the gateway.
          reduceOnly: message.reduceOnly,
          poolExecution: true,
          chainId,
        });
      });
    },
    onSuccess: (_, input) => {
      const id = input.accountId.toString();
      queryClient.invalidateQueries({
        queryKey: liqQueryKeys.orders.open(id),
      });
      queryClient.invalidateQueries({
        queryKey: liqQueryKeys.orders.conditional(id),
      });
    },
  });
}
