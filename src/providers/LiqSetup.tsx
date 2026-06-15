import {
  LiqProvider,
  TurnkeyProviderWrapper,
  useGatewayStore,
} from "@liq/react";
import { LiqClient, LiqOnchain } from "@liq/sdk";
import { type ReactNode, useEffect, useMemo } from "react";
import { createPublicClient, http } from "viem";
import { useChainId, useWalletClient } from "wagmi";

import { megaethTestnet } from "../config/chain";
import { env } from "../config/env";

const DEFAULT_CHAIN_ID = 6343;

/**
 * Builds the two SDK singletons and mounts <LiqProvider>.
 *
 * @remarks
 * - baseUrl points DIRECTLY at the gateway (no Next proxy); the same URL is
 *   reused for SSE, so the gateway must allow CORS from this origin.
 * - LiqClient does NOT subscribe to the gateway store — the token useEffect
 *   below is the load-bearing wiring that keeps the JWT on the client.
 * - LiqOnchain is rebuilt when the wallet changes so writes pick up the signer.
 */
export function LiqSetup({ children }: { children: ReactNode }) {
  const chainId = useChainId();
  const token = useGatewayStore((s) => s.token);
  const { data: walletClient } = useWalletClient();

  const liqClient = useMemo(
    () =>
      new LiqClient({
        baseUrl: env.gatewayUrl,
        chainId: chainId ?? DEFAULT_CHAIN_ID,
      }),
    [chainId],
  );

  const liqOnchain = useMemo(() => {
    const publicClient = createPublicClient({
      chain: megaethTestnet,
      transport: http(megaethTestnet.rpcUrls.default.http[0]),
    });
    return new LiqOnchain({
      chainId: DEFAULT_CHAIN_ID,
      publicClient,
      walletClient: walletClient ?? undefined,
    });
  }, [walletClient]);

  useEffect(() => {
    liqClient.setToken(token);
  }, [liqClient, token]);

  // Session keys (1-click trading) are flag-gated: when off (or unconfigured)
  // no <TurnkeyProviderWrapper> is rendered, so the tree is byte-identical to
  // today and order signing falls back to the wagmi wallet popup.
  const { enabled, orgId, authProxyUrl, authProxyConfigId } = env.turnkey;
  let inner: ReactNode = children;
  if (enabled && orgId) {
    inner = (
      <TurnkeyProviderWrapper
        orgId={orgId}
        authProxyUrl={authProxyUrl}
        authProxyConfigId={authProxyConfigId}
        walletConnectProjectId={env.walletConnectId || undefined}
        chainIds={[String(env.chainId)]}
        appName="Liq"
        appUrl="https://liq.cx"
      >
        {children}
      </TurnkeyProviderWrapper>
    );
  }

  return (
    <LiqProvider client={liqClient} onchain={liqOnchain}>
      {inner}
    </LiqProvider>
  );
}
