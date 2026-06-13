import { useLiqClient } from "@liq/react";
import { useQuery } from "@tanstack/react-query";

/** Current funding snapshot for a market (no dedicated SDK hook exists). */
export function useFunding(marketId: bigint | undefined) {
  const client = useLiqClient();
  return useQuery({
    queryKey: ["terminal", "funding", marketId?.toString()],
    enabled: marketId !== undefined,
    queryFn: () => client.markets.getFunding(marketId!),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
