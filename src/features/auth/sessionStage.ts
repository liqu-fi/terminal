export type SessionStage =
  | "disconnected"
  | "wrong-chain"
  | "loading"
  | "no-account"
  | "needs-signin"
  | "ready";

/**
 * Derives the connect → switch-network → create-account → sign-in → ready CTA
 * stage.
 *
 * @remarks Sign-in (useGatewayAuthMutation) requires an accountId because it
 * also flips the account into BOOK mode and registers it — so account creation
 * must precede authentication.
 *
 * `wrongChain` gates the on-chain steps: wagmi only configures MegaETH, so a
 * wallet connected on another network yields no `walletClient`, and the very
 * first on-chain write (`createAccount`) fails with "walletClient is required".
 * The address still resolves (so we are past `disconnected`) and the account
 * query runs against the RPC regardless of the wallet's chain — so without this
 * gate the user reaches create-account/sign-in and the write dies cryptically.
 *
 * `accountId` is `undefined` both while the on-chain account query is in flight
 * and when the wallet genuinely owns no account. We must not conflate them:
 * surfacing "no-account" mid-load makes the user mint a redundant account (and
 * on a slow RPC the create flow then stalls). `accountsLoading` gates the
 * "no-account" CTA behind a resolved query.
 */
export function sessionStage(input: {
  wallet: string | null;
  wrongChain: boolean;
  accountId: bigint | undefined;
  accountsLoading: boolean;
  isAuthenticated: boolean;
}): SessionStage {
  if (!input.wallet) return "disconnected";
  if (input.wrongChain) return "wrong-chain";
  if (input.accountId === undefined) {
    return input.accountsLoading ? "loading" : "no-account";
  }
  if (!input.isAuthenticated) return "needs-signin";
  return "ready";
}
