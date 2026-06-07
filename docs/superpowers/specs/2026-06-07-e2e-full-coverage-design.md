# E2E full coverage — design

**Date:** 2026-06-07
**Status:** approved
**Branch:** `feat-cld/e2e-full-coverage`

## Goal

Close every functional-coverage gap in the terminal's e2e suite, across both tiers:

- **Tier 1** (hermetic; mock gateway + mock chain + injected wallet; runs in CI) — 52 tests today.
- **Tier 2** (live staging; real gateway/RPC/wallet; opt-in via `E2E_LIVE=1`) — 4 tests today.

Target: 65 Tier 1 tests, 7 Tier 2 tests. Approach: **thematically additive** — extend the
existing numbered spec files where the theme already exists, new files only for genuinely new
themes. Mock-infrastructure extensions live in `e2e/support/`.

## Coverage gaps being closed

| # | Functionality | Why it is uncovered today |
|---|--------------|---------------------------|
| 1 | Wrong-chain gate (`session-wrong-chain`, switch CTA, `switch-chain-error`) — added in `12a3a67` | the injected wallet always reports chainId 6343; `wallet_switchEthereumChain` is a no-op |
| 2 | TradePreviewRow (Est. fill / Fee / Impact / Notional) | mock chain has no handlers for `getOrderFees` / `skew` / `fillPrice` / `getSettlementRewardCost`, so `useTradePreview`'s multicall fails and the row never renders in any test |
| 3 | `create-account-error` ErrorLine | no fault injection for a rejected/reverted `eth_sendTransaction` |
| 4 | Order-nonce sync (`GET /orders/nonce`, monorepo#443, SDK 0.27) | endpoint unmocked — falls into the single-order regex as `orderId="nonce"` and silently returns `null` (SDK swallows the error) |
| 5 | JWT persistence across reload (zustand persist, `localStorage['liq-gateway']`) | no reload test |
| 6 | Live 1m candles over SSE (`candles:{id}:1m`) | no candle frame fixture; chart canvas is not assertable bar-by-bar |
| 7 | Withdraw gating + dialog cancel | simply never written (deposit twin exists) |
| 8 | Debug overlays (`wallet-debug` pointer-events-none, `signin-debug` JSON) | added in `12a3a67`, no tests |
| 9 | Live deposit/withdraw, live conditional orders, live cold onboarding | Tier 2 covers only connectivity, limit place+cancel, market fill+flatten |

Explicitly **out of scope**: session keys, faucet UI, stats, funding charts, multi-market
dashboards — the README lists these as consumer extension points, not terminal features.

## Section 1 — mock-infrastructure extensions (`e2e/support/`)

### 1a. Switchable wallet chainId (`injectedWallet.ts`, `world.ts`)

- `MockWorld.chainId: number`, default `6343` in `freshWorld()`.
- `eth_chainId` / `net_version` read `world.chainId` instead of the `CHAIN_ID_HEX` constant.
- `wallet_switchEthereumChain`: when `world.faults.switchChainRejects` — throw (the page-side
  promise rejects, exactly like a user dismissing MetaMask); otherwise set `world.chainId` to the
  requested chain.
- Page-side provider: after a successful `wallet_switchEthereumChain`, emit `chainChanged` with
  the new hex chainId to registered listeners — wagmi observes it and updates
  `useAccount().chainId`. The provider's static `chainId` property is seeded from the world's
  initial value at install time.

### 1b. Trade-preview reads (`chain.ts`, `contracts.ts`, `world.ts`)

`useTradePreview` runs a 4-read multicall against `PerpsMarketProxy`. New `computeRead` handlers:

| Read | Returns |
|------|---------|
| `getOrderFees(marketId)` | `world.orderFees` — maker 2bp / taker 6bp as WAD ratios |
| `skew(marketId)` | `world.skew`, default `0n` |
| `fillPrice(marketId, sizeDelta, price)` | `price` unchanged (fill == mark at zero skew) |
| `getSettlementRewardCost(marketId, strategyId)` | `0n` |

ABI items are taken from the `@liq/onchain` dist ABI (selector match guaranteed), not
hand-written. Calls flow through the already-supported `aggregate3` path; an unhandled selector
still fails loud.

### 1c. `GET /orders/nonce` (`mockGateway.ts`, `world.ts`)

- `world.orderNonce: bigint`, default `7n` (non-zero so seeding is observable), plus a
  `world.orderNonceRequests` counter.
- The route is matched **before** the single-order regex (today `/orders/nonce` is mis-matched as
  `orderId="nonce"` → `null`).
- Response: `{ nextNonce: world.orderNonce.toString() }`.

### 1d. Candle SSE fixture + channel recording (`world.ts`, `mockGateway.ts`)

- `sseCandleFrame(marketId, bar)` helper → frame with `channel: "candles:{id}:1m"` and the bar
  payload (`bucketStartTs/timestamp`, OHLCV, `tradeCount`, `lastTradePrice`).
- The SSE route records each connection's `channels` query param into `world.sseConnections`,
  so specs can assert the chart actually subscribed.
- `applySseEffects` ignores non-`order_update` frames (already true).

### 1e. New faults + recordings (`world.ts`, `injectedWallet.ts`)

- `faults.switchChainRejects?: boolean` (see 1a).
- `faults.walletSendRejects?: boolean` — the next `eth_sendTransaction` throws
  `"User rejected the request"` (drives `create-account-error`).
- The wallet records signature requests (`personal_sign`, `eth_signTypedData*`) into
  `world.signRequests: string[]` — lets the reload spec assert no second SIWE happened.

### 1f. Page objects

- `AppPage`: `wrongChainStage`, `switchChainButton`, `switchChainError`, `createAccountError`,
  `walletDebug`, `signinDebug` locators.
- `TradePanel`: `preview` locator (`data-testid="trade-preview"`).

## Section 2 — new Tier 1 tests (13; suite 52 → 65)

| File | Test |
|------|------|
| `01-onboarding` (+4) | a wallet on a foreign chain is gated, switch lands in sign-in, then the terminal (full recovery) |
| | a rejected chain switch surfaces `switch-chain-error` and stays gated |
| | a rejected create-account tx surfaces `create-account-error`; retry succeeds once the fault clears |
| | debug overlays: `wallet-debug` visible with `pointer-events: none` (never intercepts clicks); `signin-debug` renders the status JSON |
| `03-deposit-withdraw` (+2) | withdraw submit is gated on a non-empty amount |
| | cancelling the withdraw dialog closes it without sending a tx |
| `04-trade-market` (+1) | **#443 regression**: the client seeds its order nonce from the gateway — first submit carries nonce 7, second nonce 8 |
| `11-live-sse` (+1) | the chart subscribes to `candles:200:1m` (asserted via recorded SSE channels) and survives a streamed closed bar (smoke — bar math stays unit-tested in `candleMapping.test.ts`) |
| `14-trade-preview` (new, +3) | entering a size reveals the preview: Est. fill $70,000.00, Fee $42.00 (6bp taker on $70k), Impact 0.00% (fill == mark at zero skew), Notional $70,000.00 |
| | changing size 1 → 2 doubles the notional |
| | clearing the size hides the preview (300ms debounce tolerated by expect timeout) |
| `15-session-persistence` (new, +2) | a reload with a persisted JWT returns to the terminal **without a second SIWE** (`signRequests` unchanged, no new `/auth/verify`; clicking connect is tolerated if wagmi doesn't auto-reconnect) |
| | after a reload the order nonce re-syncs from the gateway (`orderNonceRequests` grew) |

Note: leverage-slider → size is already covered in `07-trade-gating`; not duplicated.

## Section 3 — new Tier 2 (live) specs (3 files; suite 4 → 7)

| File | Scenario | Self-cleaning |
|------|----------|---------------|
| `live-deposit-withdraw.live.spec.ts` | deposit a small amount (~$5) → margin grows → withdraw the same → margin returns ≈ to start. Real USDC→sUSDC multicall + `modifyCollateral` on staging | yes — round-trip returns the funds |
| `live-conditional.live.spec.ts` | stop-market trigger priced never to fire → `TRIGGER_PENDING` row in Open Orders → cancel → row clears | yes — order is cancelled |
| `live-onboarding.live.spec.ts` | **gated behind `E2E_LIVE_ONBOARDING=1`** (on top of `E2E_LIVE`): freshly derived wallet (outside the worker pool) → gas via faucet → connect → Create Account (mints an NFT) → SIWE → terminal with $0 margin and the deposit hint | NFT remains on staging — hence the flag; runs are deliberate |

Plumbing: `E2E_LIVE_ONBOARDING` joins `e2e/tier2/env.ts` + `.env.e2e.example`; same
`test.skip(!gate.ok)` gating pattern. `playwright.live.config.ts` already matches
`*.live.spec.ts` — no config change.

## Section 4 — risks & verification

1. **wagmi reconnect-on-mount unknown** → the persistence test is framed as "no second SIWE",
   tolerant of either reconnect behavior; actual behavior checked during implementation.
2. **Staging quirk (memory): "limit orders settle not rest"** — the existing live limit test
   works; conditional behavior verified on the first live run, price/asserts adjusted if needed.
3. **ABI exactness** — preview-read ABI items come from the `@liq/onchain` dist; a selector
   mismatch fails loud ("unhandled selector"), never silently.
4. **Chart canvas is not assertable** — the candle test is an honest smoke + channel-subscription
   assert; bar math stays in the unit layer.
5. **`chainChanged` wiring** — if the wagmi connector needs more events, the wrong-chain test
   fails loudly on the UI transition; debugged at implementation time.

**Verification:** full `pnpm test:e2e` (65 tests) green locally; `pnpm test:e2e:live` against
staging with `.env.e2e.local` secrets, including one `E2E_LIVE_ONBOARDING=1` run. CI unchanged:
Tier 1 is hermetic; Tier 2 stays opt-in.

**Git:** branch `feat-cld/e2e-full-coverage`, draft PR to `main` (standalone repo — not the
monorepo's `staging` convention).
