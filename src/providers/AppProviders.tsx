import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { ConnectKitProvider } from 'connectkit';
import { LiqProvider } from '@liq/react';
import { LiqOnchain } from '@liq/onchain';
import { usePublicClient } from 'wagmi';
import { useMemo, type ReactNode } from 'react';

import { wagmiConfig } from '../config/wagmi';
import { liqClient } from '../config/liq';
import { env } from '../config/env';
import { useWalletSync } from '../hooks/useWalletSync';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
});

function LiqProviderWithOnchain({ children }: { children: ReactNode }) {
  const publicClient = usePublicClient();
  useWalletSync();

  const liqOnchain = useMemo(() => {
    if (!publicClient) return null;
    return new LiqOnchain({
      chainId: env.chainId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      publicClient: publicClient as any,
    });
  }, [publicClient]);

  if (!liqOnchain) return <>{children}</>;

  return (
    <LiqProvider client={liqClient} onchain={liqOnchain}>
      {children}
    </LiqProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider theme="midnight">
          <LiqProviderWithOnchain>{children}</LiqProviderWithOnchain>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
