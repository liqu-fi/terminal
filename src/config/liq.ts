import { LiqClient } from '@liq/api-client';
import { env } from './env';

export const liqClient = new LiqClient({
  baseUrl: env.gatewayUrl,
  chainId: env.chainId,
});
