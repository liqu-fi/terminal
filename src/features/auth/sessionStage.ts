export type SessionStage =
  | "disconnected"
  | "no-account"
  | "needs-signin"
  | "ready";

/**
 * Derives the connect → create-account → sign-in → ready CTA stage.
 *
 * @remarks Sign-in (useGatewayAuthMutation) requires an accountId because it
 * also flips the account into BOOK mode and registers it — so account creation
 * must precede authentication.
 */
export function sessionStage(input: {
  wallet: string | null;
  accountId: bigint | undefined;
  isAuthenticated: boolean;
}): SessionStage {
  if (!input.wallet) return "disconnected";
  if (input.accountId === undefined) return "no-account";
  if (!input.isAuthenticated) return "needs-signin";
  return "ready";
}
