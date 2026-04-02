import { createConfig, http } from 'wagmi';
import { type Chain } from 'viem';
import { env } from './env';

const megaethTestnet: Chain = {
  id: env.chainId,
  name: 'MegaETH Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://carrot.megaeth.com/rpc'] },
  },
};

export const wagmiConfig = createConfig({
  chains: [megaethTestnet],
  transports: {
    [megaethTestnet.id]: http(),
  },
});
