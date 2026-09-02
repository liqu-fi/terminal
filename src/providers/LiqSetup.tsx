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

  // `sessionKey` передаётся ВСЕГДА, а не под флагом Turnkey: флаг выбирает
  // ИСТОЧНИК ключа (бэкенд Turnkey против ключа в localStorage), а не наличие
  // сессии. Погасив пропс вместе с флагом, мы отняли бы одноклик у всех, кто
  // держит ключ локально, — и подпись молча ушла бы в кошелёк.
  //
  // Обёртка Turnkey — снаружи: `LiqProvider` с этим пропсом зовёт
  // `useSessionKeyManager`, которому нужен её контекст сверху.
  const { enabled, orgId, authProxyUrl, authProxyConfigId } = env.turnkey;
  const provider = (
    <LiqProvider client={liqClient} onchain={liqOnchain} sessionKey={env.turnkey}>
      {children}
    </LiqProvider>
  );

  if (!enabled || !orgId) return provider;

  return (
    <TurnkeyProviderWrapper
      orgId={orgId}
      authProxyUrl={authProxyUrl}
      authProxyConfigId={authProxyConfigId}
      walletConnectProjectId={env.walletConnectId || undefined}
      chainIds={[String(env.chainId)]}
      appName="Liq"
      // Must be the ORIGIN THIS BUILD IS SERVED FROM, not a fixed liq.cx:
      // it becomes WalletConnect's `appMetadata.url`, which the wallet shows
      // in its approval sheet. Hardcoding liq.cx made every preview/staging
      // deploy claim to be liq.cx — WalletConnect warns about the mismatch,
      // and to a user it reads like a phishing page.
      appUrl={window.location.origin}
    >
      {provider}
    </TurnkeyProviderWrapper>
  );
}
