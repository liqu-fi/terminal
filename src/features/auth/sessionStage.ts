export type SessionStage =
  | "disconnected"
  | "loading"
  | "no-account"
  | "needs-signin"
  | "ready";

/**
 * Derives the connect → create-account → sign-in → ready CTA stage.
 *
 * @remarks Sign-in (useGatewayAuthMutation) requires an accountId because it
 * also flips the account into BOOK mode and registers it — so account creation
 * must precede authentication.
 *
 * `accountId` is `undefined` both while the on-chain account query is in flight
 * and when the wallet genuinely owns no account. We must not conflate them:
 * surfacing "no-account" mid-load makes the user mint a redundant account (and
 * on a slow RPC the create flow then stalls). `accountsLoading` gates the
 * "no-account" CTA behind a resolved query.
 */
export function sessionStage(input: {
  wallet: string | null;
  accountId: bigint | undefined;
  accountsLoading: boolean;
  isAuthenticated: boolean;
}): SessionStage {
  if (!input.wallet) return "disconnected";
  if (input.accountId === undefined) {
    return input.accountsLoading ? "loading" : "no-account";
  }
  if (!input.isAuthenticated) return "needs-signin";
  return "ready";
}
