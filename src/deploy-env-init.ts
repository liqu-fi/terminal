import { setDeployEnv } from "@liq/sdk";

// The SDK's getChainConfig picks staging vs prod (both chainId 6343) via
// resolveDeployEnv. Browsers have no process.env, so without an explicit signal
// the SDK defaults to production — a staging terminal would then read the
// wallet's prod SNX account (FORBIDDEN at the staging gateway), sign EIP-712
// over the prod verifyingContract, and use prod token/collateral ids.
//
// Tell the SDK the deploy explicitly, once, before any @liq/* getChainConfig
// call. MUST stay the first import in main.tsx. Replaces the earlier
// process.env shim with the SDK's first-class API (@liqcx/liq-core ≥ 0.27.6).
const deployEnv =
  import.meta.env.VITE_DEPLOY_ENV === "production" ? "production" : "staging";
setDeployEnv(deployEnv);
