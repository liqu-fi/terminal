/**
 * Resolves the gateway base URL, failing loud when it is missing.
 *
 * A blank `VITE_GATEWAY_URL` used to silently become `baseUrl: ""`, which makes
 * every gateway call (the SIWE `/auth/nonce` that opens sign-in, `/markets`, SSE)
 * hit a relative URL and fail with no visible cause — the "dead Sign In button".
 * Refusing to boot without it surfaces the real problem at startup instead.
 */
function requireGatewayUrl(): string {
  const url = (import.meta.env.VITE_GATEWAY_URL ?? "").replace(/\/$/, "");
  if (!url) {
    throw new Error(
      "VITE_GATEWAY_URL is not set. Without it the terminal cannot reach the " +
        "order-gateway, so sign-in (SIWE) and every gateway request fail " +
        "silently. Copy .env.example to .env and set VITE_GATEWAY_URL " +
        "(e.g. https://staging.hype.cheap/v1 — include the /v1 version prefix).",
    );
  }
  return url;
}

export const env = {
  deployEnv: (import.meta.env.VITE_DEPLOY_ENV ?? "staging") as
    | "staging"
    | "production",
  chainId: Number(import.meta.env.VITE_CHAIN_ID ?? 6343),
  gatewayUrl: requireGatewayUrl(),
  rpcUrl: import.meta.env.VITE_RPC_URL ?? "https://carrot.megaeth.com/rpc",
  walletConnectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "",
};
