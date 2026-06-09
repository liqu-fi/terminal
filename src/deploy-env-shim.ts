/**
 * The SDK's `getChainConfig` resolves the contract deploy (staging vs production
 * — both chainId 6343) at runtime by reading `globalThis.process.env.DEPLOY_ENV`
 * (see @liqcx/liq-core `resolveDeployEnv`). That **dynamic** access is NOT what
 * vite's `define: { "process.env.DEPLOY_ENV": … }` rewrites — define only
 * replaces the literal token `process.env.DEPLOY_ENV`, not `globalThis.process`
 * + a bracketed key. So in a browser build `globalThis.process` is `undefined`
 * and the SDK silently defaults to `production`: a staging terminal then reads
 * the wallet's **prod** SNX account and the staging gateway rejects it with
 * `FORBIDDEN ... onchain: 0x0`.
 *
 * Bridge `VITE_DEPLOY_ENV` (which vite DOES statically inline) into
 * `globalThis.process.env.DEPLOY_ENV`. This module has no imports and MUST be
 * imported before any `@liq/*` module — `@liq/onchain`'s faucet calls
 * `getChainConfig` at module-load time, so the value has to be set first.
 */
const deployEnv = import.meta.env.VITE_DEPLOY_ENV ?? "staging";
const g = globalThis as {
  process?: { env?: Record<string, string | undefined> };
};
g.process ??= { env: {} };
g.process.env ??= {};
g.process.env.DEPLOY_ENV = deployEnv;
