export const env = {
  gatewayUrl: import.meta.env.VITE_GATEWAY_URL as string || 'http://localhost:4000',
  chainId: Number(import.meta.env.VITE_CHAIN_ID) || 6343,
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string || '',
} as const;
