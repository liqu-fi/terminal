import {
  selectIsAuthenticated,
  useAccountId,
  useCreateAccountMutation,
  useGatewayAuthMutation,
  useGatewayStore,
  useWallet,
} from "@liqcx/liq-react";
import type { ReactNode } from "react";

import { Button } from "../../components/ui/Button";
import { ConnectButton } from "../wallet/ConnectButton";
import { sessionStage } from "./sessionStage";
import { useOrderMode } from "./useOrderMode";

/** Renders children only when the session is `ready`; otherwise shows the next CTA. */
export function SessionGate({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const accountId = useAccountId();
  const isAuthenticated = useGatewayStore(selectIsAuthenticated);
  const { data: orderMode } = useOrderMode(accountId);

  const createAccount = useCreateAccountMutation();
  const auth = useGatewayAuthMutation();

  const stage = sessionStage({ wallet, accountId, isAuthenticated });

  if (stage === "disconnected") {
    return (
      <Centered>
        <ConnectButton />
      </Centered>
    );
  }
  if (stage === "no-account") {
    return (
      <Centered>
        <p className="text-muted">No SNX account yet.</p>
        <Button
          disabled={createAccount.isPending}
          onClick={() => createAccount.mutate(undefined)}
        >
          {createAccount.isPending ? "Creating…" : "Create Account"}
        </Button>
      </Centered>
    );
  }
  if (stage === "needs-signin") {
    const alreadyBookMode = orderMode === "BOOK";
    return (
      <Centered>
        <p className="text-muted">Sign in to the gateway (SIWE).</p>
        <Button
          disabled={auth.isPending || accountId === undefined}
          onClick={() =>
            accountId !== undefined &&
            auth.mutate({ accountId, alreadyBookMode })
          }
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

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      {children}
    </div>
  );
}
