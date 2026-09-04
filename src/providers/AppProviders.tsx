import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";

import { getConfig } from "../config/chain";
import { IdentityDoorProvider } from "../features/auth/IdentityDoorProvider";
import { LiqSetup } from "./LiqSetup";

const queryClient = new QueryClient();
const wagmiConfig = getConfig();

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* reconnectOnMount выключен: восстановлением владеет
          IdentityDoorProvider — он поднимает ровно ту дверь, которой входили,
          а не первый авторизованный коннектор. */}
      <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
        <IdentityDoorProvider>
          <LiqSetup>{children}</LiqSetup>
        </IdentityDoorProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
