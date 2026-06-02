export const env = {
  deployEnv: (import.meta.env.VITE_DEPLOY_ENV ?? "staging") as
    | "staging"
    | "production",
  chainId: Number(import.meta.env.VITE_CHAIN_ID ?? 6343),
  gatewayUrl: (import.meta.env.VITE_GATEWAY_URL ?? "").replace(/\/$/, ""),
  rpcUrl: import.meta.env.VITE_RPC_URL ?? "https://carrot.megaeth.com/rpc",
  walletConnectId: import.meta.env.VITE_WALLETCONNECT_V2_ID ?? "",
};
