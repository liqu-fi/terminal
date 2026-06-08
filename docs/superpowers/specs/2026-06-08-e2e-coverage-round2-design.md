# E2E coverage round 2 — audit-driven gap closure — design

**Date:** 2026-06-08
**Status:** approved
**Branch:** `feat-cld/e2e-coverage-round2`

## Goal

The 2026-06-07 "full coverage" effort (merged in PR #15) closed every **happy-path** gap and hit its
target (Tier 1 63 / Tier 2 6). A fresh component-by-component audit of `src/` against the suite found
~41 still-uncovered observable behaviors, concentrated in four classes the first pass did not reach:

1. **Error / loading branches** — table fetch-500 for price/funding/candles/orders/trades, loading
   skeletons, `—` placeholders.
2. **"Assert what is actually wired"** — `acceptablePrice`/slippage on the market order, `triggerAbove`
   on the conditional, `limitPrice == acceptablePrice` on the limit. The pure math is unit-tested; the
   form→gateway wiring is not asserted.
3. **Edge states** — short-side preview, conditional `Size = abs(negative)`, `—` no-price row, cancel of
   a conditional, SSE `→ CANCELLED` removal, market-switch chart re-subscribe, tab `aria-pressed`.
4. **Two real bugs + dead code** — D2 (withdraw never validates input → uncaught throw, no error UI),
   D3 (deposit revert surfaces nothing, tracked as liqcx/monorepo#434), and `useOrderMode` (defined,
   imported nowhere).

This round closes the **P0 + P1** subset (~27 tests), **fixes** the two bugs, removes the dead hook, and
adds one unit test for a boot-time guard that e2e structurally cannot reach. Approach stays
**thematically additive** — extend the existing numbered specs; mock-infra extensions live in
`e2e/support/`. Lower-value P2 items are explicitly deferred (Section 4) with reasons, not silently
dropped.

Target: Tier 1 63 → ~90; Tier 2 unchanged (6, opt-in); vitest 4 → 5 files.

## Audit gap inventory (what this round addresses)

IDs are the audit's; `infra` = needs a new mock hook. Confidence from the audit.

| ID | Behavior uncovered today | Priority | Needs infra |
|----|--------------------------|----------|-------------|
| T1 | market order `acceptablePrice` = mark ± 50bps (BUY adds / SELL subtracts) never asserted on `submittedOrders` | P0 | no |
| T2 | limit order sends `acceptablePrice == limitPrice` (distinct from the slippage path) | P0 | no |
| T3 | empty / un-parseable price silently no-ops submit (Limit & Stop/TP) — submit is *enabled*, click sends nothing, no error | P0 | no |
| T4 | gateway 4xx/5xx error surfacing for **LIMIT** and **CONDITIONAL** submits (only MARKET is covered); form not reset | P1 | no |
| T5 | trigger-direction default (`≥` active) + `aria-pressed` mutual-exclusion + submitted `triggerAbove` boolean | P0 | no |
| T6 | conditional POST omits `acceptablePrice` (contract: what is *not* sent) | P0 | no |
| T7 | short-side (signed negative `sizeDelta`) trade preview | P1 | no |
| P2b | open-orders `Status` cell value (`PENDING` / `TRIGGER_PENDING`) | P0 | no |
| P2c | conditional row `Size` = `abs(negative sizeDelta)` → renders `1`, not `-1` | P0 | no |
| P2d | conditional `—` no-price branch (`px` null or `"0"`) | P0 | no |
| P3a | cancel of a conditional (TRIGGER_PENDING) row (only resting LIMIT cancel is covered) | P0 | no |
| P3b | SSE `→ CANCELLED` terminal frame removes the row (only MATCHED is covered) | P0 | no |
| P3c | user-info tab active/inactive `aria-pressed` styling | P0 | no |
| M5 | single-market list renders exactly one `<option>` (1 vs 0 vs N) | P0 | no |
| D1 | dialog backdrop click closes; click inside panel does **not** (`stopPropagation`) | P0 | locator |
| P1a | open-orders list fetch-500 keeps the terminal alive (silent empty, no crash) | P1 | `faults.ordersStatus` |
| P1b | history list fetch-500 keeps the terminal alive | P1 | `faults.tradesStatus` |
| M1 | price `—` placeholder + neutral color while `/price` is failing but markets are loaded | P1 | `faults.priceStatus` |
| M2 | funding `—` when `/funding` errors | P1 | `faults.fundingStatus` |
| M6 | candle history fetch-500 → chart empty-but-alive (`.catch` path, distinct from empty-array) | P1 | `faults.candlesStatus` |
| M4 | market switch → chart re-subscribes `candles:201:1m` and redraws to that market's data | P1 | per-market candles |
| A7 | connect rejection (`eth_requestAccounts` throws) keeps the app on the connect screen | P1 | `faults.connectRejects` |
| A1 | `session-loading` stage renders while the account lookup is in flight | P1 | hold-gate |
| P2a | `positions-loading` skeleton renders while the positions read is in flight | P1 | hold-gate |
| D4 | deposit/withdraw submit shows `Depositing…`/`Withdrawing…` + disabled while the tx is pending | P1 | hold-gate |
| A5 | `requireGatewayUrl()` throws on a blank `VITE_GATEWAY_URL`; trailing-slash strip | P1 | unit |
| D2 | **BUG** — malformed withdraw amount throws synchronously in the click handler, renders no error | fix | — |
| D3 | **BUG** — reverted deposit surfaces nothing (liqcx/monorepo#434) | fix | — |
| — | `useOrderMode.ts` is dead code (zero importers) | remove | — |

## Section 1 — mock-infrastructure extensions (`e2e/support/`)

### 1a. New gateway faults (`world.ts`, `mockGateway.ts`)

Add to `MockWorld.faults`, each a one-shot/next-response status override mirroring the existing
`marketsStatus` / `cancelStatus` pattern (early `error(route, status)` in the matched route before it
serves the happy body):

| Field | Route it faults |
|-------|-----------------|
| `priceStatus?: number` | `GET /markets/:id/price` |
| `fundingStatus?: number` | `GET /markets/:id/funding` |
| `candlesStatus?: number` | `GET /markets/:id/candles` |
| `ordersStatus?: number` | `GET /orders` (resting + the `status=…TRIGGER_PENDING` variant) |
| `tradesStatus?: number` | `GET /trades` |

And one wallet fault in `injectedWallet.ts`:

- `connectRejects?: boolean` — the next `eth_requestAccounts` throws `"User rejected the request"`
  (drives A7; mirrors the existing `walletSendRejects` / `switchChainRejects`).

### 1b. Deterministic hold-gate (`world.ts`, plus the three interceptors)

The loading-state tests (A1, P2a, D4) must observe a transient UI frame without a timing race. Add a
named-barrier mechanism — **not** a fixed delay:

- `world.holds: Record<string, { promise: Promise<void>; release: () => void }>`.
- Helpers `armHold(world, name)` (installs an unresolved promise + its resolver) and
  `releaseHold(world, name)` (resolves it). Exposed to specs via the `world` fixture.
- Three hold points `await world.holds[name]?.promise` **before** responding, no-op when the gate is
  unarmed (so every existing test is unaffected):
  - `accountRead` — the `getAccountIds` account-lookup `eth_call` (keeps `accountsLoading` true → A1).
  - `positionsRead` — the enriched-positions read multicall (keeps `useEnrichedPositions.isLoading`
    true → P2a).
  - `collateralReceipt` — `eth_getTransactionReceipt` for the `modifyCollateral` tx (keeps the
    mutation `isPending` true → D4).

Spec shape: `armHold(world,'accountRead')` → drive UI → `await expect(app.loadingGate).toBeVisible()`
→ `releaseHold(world,'accountRead')` → assert the settled stage. Fully deterministic; no `waitForTimeout`.

(Considered and rejected: a fixed `delayMs` fault — simpler but races the assertion against the timer
and reintroduces flake, which is exactly what the Tier-1 cold-start memory warns against.)

### 1c. Per-market candles (`world.ts`, `mockGateway.ts`)

`useCandles` re-`history()`s and re-`subscribe()`s on `marketId` change, but the mock serves one global
`world.candles` for every id, so a switch can't be observed as *different data*.

- Add `world.candlesByMarket?: Record<string, MockWorld["candles"]>`.
- `GET /markets/:id/candles` returns `candlesByMarket[id] ?? candles` (back-compatible default).
- M4 seeds two visually distinct sets (e.g. flat vs sloped) and asserts both the new SSE channel
  (`candles:201:1m` via the existing `sseConnections` recording) **and** a canvas pixel-hash change
  (the technique `11-live-sse` already uses).

### 1d. Dialog overlay locator (`src/components/ui/Dialog.tsx`, `e2e/pages/`)

- Add `data-testid="dialog-overlay"` to the backdrop div in `Dialog.tsx` (the only source touch outside
  the bug fixes; the panel already `stopPropagation`s).
- Page object: `dialogOverlay` locator. D1 asserts overlay-click closes; panel-click (e.g. the heading)
  leaves it open and sends no tx (`lastCollateralDelta === 0n`).

### 1e. Page-object additions (`e2e/pages/AppPage.ts`, `TerminalPanels.ts`)

Small, convention-following locators: `loadingGate` already exists (`session-loading`); add
`positionsLoading`; `TradePanel.preview` is already present (reuse for short-side T7);
`UserInfoPanel.orderRow(id).locator('td').nth(n)` cell access is used directly in specs (no new helper);
`tab(name)` already exists (reuse for `aria-pressed` P3c). Net new locators: `dialogOverlay`,
`positionsLoading`.

## Section 2 — source fixes (`src/`)

### 2a. D2 — validate the withdraw amount (real fix)

`WithdrawDialog.onWithdraw` calls `Margin.parse(amount)` **eagerly** before `withdraw.mutate(...)`
(`WithdrawDialog.tsx:51-54`), so a non-numeric / over-precision amount throws an uncaught error in the
click handler and `withdraw-error` never renders — the submit button is enabled for any non-empty
string. `DepositDialog` does not have this bug because it passes the raw string into the mutation, where
the SDK parses it async and a failure surfaces via `deposit.error` (`DepositDialog.tsx:24-32`).

**Fix (symmetric with deposit):** move the parse inside the mutation so a throw becomes the mutation's
error instead of escaping the handler. Change the `useTransactionMutation` payload to carry the raw
string and parse in `mutationFn`:

```ts
const withdraw = useTransactionMutation<`0x${string}`, { accountId: bigint; amount: string }>({
  transactionType: "WITHDRAW",
  mutationFn: ({ accountId, amount }) =>
    onchain.deposit.modifyCollateral(accountId, 0n, -Margin.parse(amount)),
  // …invalidateKeys / onTransactionSuccess unchanged
});
function onWithdraw() {
  if (accountId === undefined || !amount) return;
  withdraw.mutate({ accountId, amount }); // no eager parse
}
```

react-query catches a synchronous throw inside `mutationFn` and sets `withdraw.error`, so malformed
input now renders `withdraw-error` and sends no tx. **Test (in `03-deposit-withdraw`):** fill `"abc"`,
submit, assert `withdraw-error` visible **and** `world.lastCollateralDelta === 0n`. (Implementation note:
confirm `Margin.parse`'s throw-on-bad-input behavior during TDD; if it coerces instead of throwing, fall
back to an explicit `try/parse → setError` guard achieving the same observable outcome.)

### 2b. D3 — deposit revert surfaces nothing (liqcx/monorepo#434)

A reverted deposit (`faults.collateralReverts`) produces no `deposit-error` and an unhandled rejection.
The deposit mutation is the SDK's `useDepositMutation()` (`@liqcx/liq-*`, consumed from GitHub Packages —
**not editable in this repo**). Plan: during TDD, attempt the in-repo mitigation — add an explicit
`onError` to the `mutate` options (alongside the existing `onSuccess`) and verify whether the revert ever
reaches the mutation's error channel. **If** it does, render `deposit-error` and assert it. **If** the SDK
swallows the revert (the #434 root cause), document that the full fix requires an SDK change and pin the
**stable** observable outcome instead: after a reverted deposit, margin is unchanged
(`market.margin` stays `$0.00`), the dialog stays open, and `world.lastCollateralDelta === 0n` — with a
`// NOTE: pins liqcx/monorepo#434` comment. This honors "fix in-pass where the fix lives in this repo;
be explicit at the repo boundary."

### 2c. Remove `useOrderMode.ts`

`src/features/auth/useOrderMode.ts` is imported nowhere in `src/` (verified by two independent audit
passes). Delete the file. No test is added (a test would lock in unused surface). The book-vs-onchain
submit decision lives inside the SDK, not this app, so nothing observable changes.

### 2d. Unit test for the gateway-URL boot guard (A5)

`config/env.ts`'s `requireGatewayUrl()` throws a descriptive error at module load when
`VITE_GATEWAY_URL` is blank (the documented fix for the "dead Sign In button" silent failure) and strips
a trailing slash. e2e structurally cannot reach this — the Vite dev server always boots with a valid URL
(`e2e/support/constants.ts`). Add `src/config/__tests__/env.test.ts` (vitest): with
`vi.stubEnv("VITE_GATEWAY_URL","")` + `vi.resetModules()` a dynamic `import("../env")` throws with the
guard message; a second case asserts a trailing-slash URL is stored without the trailing `/`. This is the
only non-e2e addition — included because the guard protects a real boot-time failure mode and is
otherwise untestable.

## Section 3 — new tests by file (Tier 1, ~27)

Additive into existing `describe` blocks unless noted.

| File | Tests added |
|------|-------------|
| `04-trade-market` | T1: after a BUY, `submittedOrders.at(-1).acceptablePrice == (mark + mark*50/10_000)`; SELL → minus branch |
| `05-trade-limit` | T2: `acceptablePrice == limitPrice`; T3a: empty `limitPrice` + valid size → submit enabled, click sends nothing, no error |
| `06-trade-conditional` | T5: default `trigger-above` `aria-pressed=true`, click below flips both, submitted `triggerAbove===false`; T6: `acceptablePrice` undefined on the conditional payload; T3b: empty trigger → no-op |
| `12-errors` | T4: limit & conditional submit-500 → `trade-error`, inputs preserved; P1a: `ordersStatus=500` → terminal alive, `orders-empty`; P1b: `tradesStatus=500` → terminal alive, `history-empty`; M1: `priceStatus=500` → price `—`; M2: `fundingStatus=500` → funding `—`; M6: `candlesStatus=500` → canvas present, terminal healthy |
| `02-market-data` | M5: exactly one `<option>`; M4: switch to ETH → `sseConnections` gains `candles:201:1m` + canvas pixel-hash changes |
| `08-positions` | P2a: `armHold('positionsRead')` → `positions-loading` visible → release → row settles; P3c: selected tab `aria-pressed=true`, sibling `false` |
| `09-orders-cancel` | P2b: `PENDING` / `TRIGGER_PENDING` status cells; P2c: conditional `Size` cell text `1`; P2d: null-price conditional → `—`; P3a: cancel `ord-cond-1` → `orders-empty` + `cancelledOrderIds` |
| `11-live-sse` | P3b: `sseOrderUpdateFrame('ord-limit-1','CANCELLED')` → `orders-empty` |
| `14-trade-preview` | T7: click `sideShort`, enter size → preview visible, notional `$70,000.00` (sign-independent) |
| `01-onboarding` | A1: `armHold('accountRead')` → `session-loading` visible → release → `needs-signin`; A7: `connectRejects` → stays on `disconnected` |
| `03-deposit-withdraw` | D1: overlay-click closes / panel-click stays open + no tx; D4: `armHold('collateralReceipt')` → `Depositing…`/`Withdrawing…` + disabled → release → settles; D2-fix: `"abc"` → `withdraw-error`, no tx; D3: outcome per Section 2b |

## Section 4 — explicitly deferred (not done this round)

Listed so the deferral is visible, not silent:

| ID | Why deferred |
|----|--------------|
| A2 | signin-button disabled needs infra to suppress/err the walletClient on the correct chain — no clean deterministic hook; low ROI |
| A3 | post-switch walletClient refetch recovery — low confidence, the mock rebuilds the client cleanly on `chainChanged`, masking the cached-error path the effect guards |
| A6 | `getConfig()` walletConnect branch — config plumbing, not user-facing; pure unit, low priority |
| A8 | `LiqSetup` token→client wiring — already protected transitively by every onboarding e2e |
| D5 | deposit/withdraw submit disabled on `accountId === undefined` — unreachable via the UI (dialogs mount only behind an owned account); defensive code |
| D6 | over-withdraw / withdrawable < available revert — the thin Tier-1 mock sets `withdrawable == available`; a hermetic test would need contract-faithful collateral logic. Candidate for a future Tier-2 assertion |
| M3 | `useFunding` disabled when `marketId` undefined — overlaps M2's `—` assertion; proving "no request fired" needs a request counter, low marginal value |
| M8 | Tier-2 live market-data assertions (price/funding/canvas after sign-in) — values are non-deterministic; a regex-only live smoke is a separate Tier-2 task |
| P3d | history `Time` cell — `toLocaleTimeString()` is locale/timezone-dependent; brittle |
| P3e | history multi-row ordering — the component does no sorting; near-zero regression value |
| T8/T9 | leverage 1× lower-bound / `maxLeverage`-drives-slider-`max` — pure attribute wiring, low value |

## Section 5 — risks & verification

1. **`Margin.parse` behavior (D2)** — the fix assumes it throws on bad input. If it coerces, the
   symmetric-mutation route won't error; fall back to an explicit parse-guard that sets the error state.
   Verified by the D2 test failing-first on the un-fixed code, then green after the fix.
2. **D3 repo boundary** — the deposit mutation is SDK-owned; the fix may be limited to surfacing an
   error the SDK already throws, or fall back to pinning the stable outcome. Either way the test asserts
   a deterministic observable; no flake.
3. **Hold-gate wiring** — if a hold point sits at the wrong interceptor the loading frame never appears
   and the test fails loudly (visible-timeout), not silently. Each gate is unarmed-by-default so existing
   specs are untouched.
4. **Pixel-hash redraw (M4)** — canvas assertions are smoke-level; the channel-subscription assert via
   `sseConnections` is the deterministic anchor, the pixel-hash is the secondary signal (same posture as
   the existing live-SSE candle test).
5. **No Tier-2 change** — every addition is Tier-1 hermetic or a unit test; `pnpm test:e2e:live` is
   untouched and stays opt-in. CI (hermetic Tier 1) gains ~27 tests.

**Verification gate:** `pnpm test:e2e` green (Tier 1 ~90); `pnpm test` green incl. the new
`config/__tests__/env.test.ts`; `pnpm lint` + `pnpm typecheck` clean. Branch
`feat-cld/e2e-coverage-round2`, **draft** PR to `main` (standalone repo — not the monorepo's `staging`
convention).
