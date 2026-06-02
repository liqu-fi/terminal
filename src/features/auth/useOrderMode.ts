import { useLiqOnchain } from "@liq/react";
import { useQuery } from "@tanstack/react-query";

/** Order/settlement mode of an SNX account NFT, or undefined while loading. */
export function useOrderMode(accountId: bigint | undefined) {
  const onchain = useLiqOnchain();
  return useQuery({
    queryKey: ["terminal", "order-mode", accountId?.toString()],
    enabled: accountId !== undefined,
    queryFn: () => onchain.accounts.getOrderMode(accountId!),
    staleTime: 15_000,
  });
}
