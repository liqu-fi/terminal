import {
  useAccountQuery,
  useCreateAccountMutation,
  useGatewayAuthMutation,
} from "@liq/react";
import { type ReactNode, useEffect } from "react";
import { useAccount, useChainId, useSwitchChain, useWalletClient } from "wagmi";

import { env } from "../../config/env";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "../wallet/ConnectButton";
import { useIdentityDoor } from "./IdentityDoorProvider";
import { useSessionStageLocal } from "./useSessionStage";

/** Renders children only when the session is `ready`; otherwise shows the next CTA. */
export function SessionGate({ children }: { children: ReactNode }) {
  return (
    <>
      {env.debugWallet && <WalletDebug />}
      <SessionGateInner>{children}</SessionGateInner>
    </>
  );
}

/**
 * Integrator-facing diagnostic overlay: live wagmi wallet state (status, chain,
 * walletClient) so a misconfigured wallet/chain is visible at a glance during
 * onboarding.
 *
 * @remarks За флагом `VITE_DEBUG_WALLET`, по умолчанию выключен. Это `fixed`-слой
 * в левом нижнем углу: на 1024×768 он закрывал половину таблицы позиций, а
 * `pointer-events-none` спасает только от перехвата кликов, но не от того, что
 * данных под ним не видно. Кому оверлей нужен — включает флагом.
 */
function WalletDebug() {
  const account = useAccount();
  const chainId = useChainId();
  const wc = useWalletClient();
  const rows: [string, string][] = [
    ["account.status", account.status],
    ["account.isConnected", String(account.isConnected)],
    ["account.address", account.address ?? "—"],
    ["account.chainId", String(account.chainId ?? "—")],
    ["connector", account.connector?.name ?? "—"],
    ["useChainId()", String(chainId)],
    ["env.chainId", String(env.chainId)],
    ["walletClient.data", wc.data ? "present" : "undefined"],
    ["walletClient.account", wc.data?.account?.address ?? "—"],
    ["walletClient.chain", String(wc.data?.chain?.id ?? "—")],
    ["walletClient.status", wc.status],
    ["walletClient.error", wc.error?.message ?? "—"],
  ];
  return (
    <div
      className="pointer-events-none fixed bottom-2 left-2 z-50 max-w-[92vw] rounded border border-border bg-surface-2 p-2 font-mono text-[11px] leading-tight text-muted"
      data-testid="wallet-debug"
    >
      <div className="mb-1 font-semibold text-text">
        wallet debug (temporary)
      </div>
      {rows.map(([k, v]) => (
        <div key={k}>
          {k}: <span className="text-text">{v}</span>
        </div>
      ))}
    </div>
  );
}

function SessionGateInner({ children }: { children: ReactNode }) {
  const { booting } = useIdentityDoor();
  // Саму ступень вычисляет useSessionStageLocal(); здесь accountId остаётся
  // отдельно — он нужен кнопкам ниже (createAccount/signIn), а не гейту.
  const { data: accountIds } = useAccountQuery();
  const accountId = accountIds?.[0];

  // Detect a wallet on the wrong network via the CONNECTOR's chain
  // (`useAccount().chainId`), NOT `useChainId()`: the latter returns the wagmi
  // config's chain (6343) even while the wallet sits on an unconfigured chain,
  // so it can't see the mismatch. On a mismatched chain wagmi builds no
  // walletClient, so every on-chain write (createAccount) and the SIWE sign-in
  // fail with "walletClient is required" / "Wallet not connected".
  const account = useAccount();
  const wrongChain = account.isConnected && account.chainId !== env.chainId;
  const switchChain = useSwitchChain();

  const createAccount = useCreateAccountMutation();
  const auth = useGatewayAuthMutation();

  // After a wrong-chain → correct-chain transition, wagmi's walletClient query
  // may hold a cached ConnectorChainMismatchError from when the wallet was on
  // the wrong chain. staleTime: Infinity prevents an automatic re-fetch, so we
  // force one here whenever the query is in error state and we're on the right
  // chain. This ensures the sign-in button is not silently broken post-switch.
  // Destructure so the effect depends on these fields, not the whole query
  // object (whose identity changes every render) — keeps exhaustive-deps happy
  // and the effect from re-running needlessly.
  const {
    data: walletClientData,
    isError: walletClientErrored,
    refetch: refetchWalletClient,
  } = useWalletClient();
  useEffect(() => {
    if (!wrongChain && walletClientErrored) {
      void refetchWalletClient();
    }
  }, [wrongChain, walletClientErrored, refetchWalletClient]);

  const stage = useSessionStageLocal();

  // Пока идёт восстановление, wagmi отвечает `disconnected`, и без этой ветки
  // гейт показывал бы экран входа кадром на каждой перезагрузке. Раньше ту же
  // роль играл `isReconnecting` внутри штатного восстановления wagmi.
  if (booting) {
    return (
      <Centered testid="session-loading">
        <p className="text-muted">Loading account…</p>
      </Centered>
    );
  }

  if (stage === "disconnected") {
    return (
      <Centered testid="session-disconnected">
        <ConnectButton />
      </Centered>
    );
  }
  if (stage === "wrong-chain") {
    return (
      <Centered testid="session-wrong-chain">
        <p className="text-muted">
          Wrong network. Switch your wallet to MegaETH (chainId {env.chainId}).
        </p>
        <Button
          disabled={switchChain.isPending}
          onClick={() => switchChain.switchChain({ chainId: env.chainId })}
          data-testid="switch-chain-button"
        >
          {switchChain.isPending ? "Switching…" : "Switch to MegaETH"}
        </Button>
        <ErrorLine error={switchChain.error} testid="switch-chain-error" />
      </Centered>
    );
  }
  if (stage === "loading") {
    return (
      <Centered testid="session-loading">
        <p className="text-muted">Loading account…</p>
      </Centered>
    );
  }
  if (stage === "no-account") {
    return (
      <Centered testid="session-no-account">
        <p className="text-muted">No SNX account yet.</p>
        <Button
          disabled={createAccount.isPending}
          onClick={() => createAccount.mutate(undefined)}
          data-testid="create-account-button"
        >
          {createAccount.isPending ? "Creating…" : "Create Account"}
        </Button>
        <ErrorLine error={createAccount.error} testid="create-account-error" />
      </Centered>
    );
  }
  if (stage === "needs-signin") {
    return (
      <Centered testid="session-needs-signin">
        <p className="text-muted">Sign in to the gateway (SIWE).</p>
        <Button
          disabled={
            auth.isPending || accountId === undefined || !walletClientData
          }
          onClick={() => accountId !== undefined && auth.mutate({ accountId })}
          data-testid="signin-button"
        >
          {auth.isPending ? "Signing…" : "Sign In"}
        </Button>
        <ErrorLine error={auth.error} testid="signin-error" />
        <pre
          className="max-w-[92vw] overflow-auto whitespace-pre-wrap text-left font-mono text-[10px] text-muted"
          data-testid="signin-debug"
        >
          {JSON.stringify(
            {
              accountId: accountId?.toString() ?? null,
              status: auth.status,
              isPending: auth.isPending,
              isError: auth.isError,
              failureCount: auth.failureCount,
              error: auth.error?.message ?? null,
            },
            null,
            2,
          )}
          {auth.error?.stack ? `\n\nSTACK:\n${auth.error.stack}` : ""}
        </pre>
      </Centered>
    );
  }
  // Authenticated/ready: render the app. Пилюля 1-click живёт в шапке
  // приложения (`SessionToolbar`) — своя строка над терминалом стоила 36px
  // высоты ради одной кнопки; гейт по аутентификации переехал туда вместе с ней.
  return <>{children}</>;
}

function Centered({
  children,
  testid,
}: {
  children: ReactNode;
  testid?: string;
}) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3"
      data-testid={testid}
    >
      {children}
    </div>
  );
}

/** Surfaces a mutation error inline so a failed CTA isn't a silent dead-end. */
function ErrorLine({ error, testid }: { error: Error | null; testid: string }) {
  if (!error) return null;
  return (
    <p className="text-sm text-short" role="alert" data-testid={testid}>
      {error.message}
    </p>
  );
}
