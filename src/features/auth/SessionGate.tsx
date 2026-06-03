import {
  selectIsAuthenticated,
  useAccountQuery,
  useCreateAccountMutation,
  useGatewayAuthMutation,
  useGatewayStore,
  useWallet,
} from "@liq/react";
import type { ReactNode } from "react";

import { Button } from "../../components/ui/Button";
import { ConnectButton } from "../wallet/ConnectButton";
import { sessionStage } from "./sessionStage";
import { useOrderMode } from "./useOrderMode";

/** Renders children only when the session is `ready`; otherwise shows the next CTA. */
export function SessionGate({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  // Pull the query's loading flag, not just `useAccountId()`: the latter
  // collapses "still loading" and "no account" into a single `undefined`,
  // which would flash the create-account CTA before the on-chain lookup
  // resolves (see sessionStage).
  const { data: accountIds, isLoading: accountsLoading } = useAccountQuery();
  const accountId = accountIds?.[0];
  const isAuthenticated = useGatewayStore(selectIsAuthenticated);
  const { data: orderMode } = useOrderMode(accountId);

  const createAccount = useCreateAccountMutation();
  const auth = useGatewayAuthMutation();

  const stage = sessionStage({
    wallet,
    accountId,
    accountsLoading,
    isAuthenticated,
  });

  if (stage === "disconnected") {
    return (
      <Centered testid="session-disconnected">
        <ConnectButton />
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
      </Centered>
    );
  }
  if (stage === "needs-signin") {
    const alreadyBookMode = orderMode === "BOOK";
    return (
      <Centered testid="session-needs-signin">
        <p className="text-muted">Sign in to the gateway (SIWE).</p>
        <Button
          disabled={auth.isPending || accountId === undefined}
          onClick={() =>
            accountId !== undefined &&
            auth.mutate({ accountId, alreadyBookMode })
          }
          data-testid="signin-button"
        >
          {auth.isPending
            ? "Signing…"
            : alreadyBookMode
              ? "Sign In"
              : "Enable Book Orders & Sign In"}
        </Button>
      </Centered>
    );
  }
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
