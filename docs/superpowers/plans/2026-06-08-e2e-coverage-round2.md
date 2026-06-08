# E2E Coverage Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the P0+P1 e2e-coverage gaps found by the 2026-06-08 audit (~27 Tier-1 tests), fix two real bugs (D2 withdraw input validation, D3 deposit-revert surfacing), remove dead `useOrderMode`, and add one unit test for the gateway-URL boot guard.

**Architecture:** Tier-1 tests are hermetic — a real Vite dev server with all I/O intercepted in-process over a single mutable `MockWorld` (`e2e/support/world.ts`) that the injected wallet, mock chain (`mockChain.ts` → `chain.ts`), and mock gateway (`mockGateway.ts`) close over. Tests seed the world, drive the UI through Page Objects (`e2e/pages/`), and assert UI + recorded world mutations. This plan first lands shared infra (a deterministic hold-barrier + new fault fields), then adds tests file-by-file, fixing the two bugs inline.

**Tech Stack:** Playwright 1.60, Vitest 4, viem, TypeScript. Spec: `docs/superpowers/specs/2026-06-08-e2e-coverage-round2-design.md`. Branch: `feat-cld/e2e-coverage-round2` (already created).

**Conventions (apply to every task):**
- Run one Tier-1 spec: `pnpm exec playwright test e2e/tier1/<file> --reporter=list` from the repo root (Vite auto-starts on 5173; override with `E2E_PORT` if occupied). Filter to one test with `-g "<title fragment>"`.
- Run the unit suite: `pnpm test` (vitest). Type-check: `pnpm typecheck`. Lint: `pnpm lint`.
- **Two kinds of test in this plan:**
  - **Characterization** — asserts existing-but-unasserted behavior; it should **PASS on first run**. If it FAILS, you found a real wiring bug — STOP and report it, do not weaken the assertion to make it pass.
  - **Infra/fix** — fails first because a fault/locator/behavior is missing; add the minimal infra/fix, then it passes.
  Each test below is labelled `[CHAR]` or `[FIX]`.
- Commit after every green task, `test(e2e): …` / `fix(…): …` / `feat(e2e): …` style.
- Never weaken an assertion to get green. A surprising failure is a finding.

---

### Task 1: Infra foundation — hold-barrier + new fault fields

Shared by later tasks (A1, P2a, D4 use the hold-barrier; the gateway/market tasks use the new fault fields). No behavior changes when nothing is armed/set, so the existing suite must stay green.

**Files:**
- Modify: `e2e/support/world.ts`
- Modify: `e2e/support/chain.ts`
- Modify: `e2e/support/mockChain.ts`

- [ ] **Step 1: Add the `Hold` type, `holds`/`candlesByMarket` fields, new faults, and arm/release helpers to `world.ts`**

In the `MockWorld.faults` block, after `submitNonceConflictExpected?: string;`, add:

```ts
    // gateway: per-endpoint next-response status override (mirror marketsStatus)
    priceStatus?: number;
    fundingStatus?: number;
    candlesStatus?: number;
    ordersStatus?: number;
    tradesStatus?: number;
    // wallet: reject the next eth_requestAccounts (user dismisses the connect prompt)
    connectRejects?: boolean;
```

In the `MockWorld` interface, after the `candles: Array<…>` field, add:

```ts
  /** Per-market candle override; the /candles route falls back to `candles`. */
  candlesByMarket?: Record<string, MockWorld["candles"]>;
```

In the `MockWorld` interface, after the `receipts` field, add:

```ts
  /** Named response barriers an interceptor awaits before replying (loading-state tests). */
  holds: Record<string, Hold>;
```

Add the `Hold` interface next to `ReceiptLog`:

```ts
export interface Hold {
  promise: Promise<void>;
  release: () => void;
}
```

In `freshWorld()`'s returned object, after `receipts: {},` add:

```ts
    holds: {},
```

Append the helpers after `nextTxHash`:

```ts
/**
 * Install an unresolved barrier under `name`. An interceptor awaits it before
 * replying, so a test can assert the in-flight UI, then release it to settle.
 * Deterministic — no fixed delay, so no timing race.
 */
export function armHold(world: MockWorld, name: string): void {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  world.holds[name] = { promise, release };
}

/** Release + remove a previously armed hold so the held response proceeds. */
export function releaseHold(world: MockWorld, name: string): void {
  world.holds[name]?.release();
  delete world.holds[name];
}
```

- [ ] **Step 2: Export the gated selectors from `chain.ts`**

After the `SET_BOOK_MODE_SELECTOR` export, add:

```ts
/** Selectors the hold-barriers match on: the account-list and positions reads. */
export const TOKEN_OF_OWNER_SELECTOR = toFunctionSelector(
  combinedAbi.find(
    (i) => i.type === "function" && i.name === "tokenOfOwnerByIndex",
  ) as AbiFunction,
);
export const GET_OPEN_POSITION_SELECTOR = toFunctionSelector(
  combinedAbi.find(
    (i) => i.type === "function" && i.name === "getOpenPosition",
  ) as AbiFunction,
);
```

- [ ] **Step 3: Await holds in `mockChain.ts`**

Change the import from `./chain` to:

```ts
import {
  handleEthCall,
  MODIFY_COLLATERAL_SELECTOR,
  TOKEN_OF_OWNER_SELECTOR,
  GET_OPEN_POSITION_SELECTOR,
} from "./chain";
```

Add this function just above `export async function mockChain`:

```ts
/**
 * Await any armed hold-barrier matching this RPC message before replying.
 * Selector matching is substring-based so it fires even when the read is nested
 * in a Multicall3 aggregate3 batch (the inner selector appears in the calldata).
 */
async function awaitHolds(world: MockWorld, msg: RpcMessage): Promise<void> {
  if (msg.method === "eth_getTransactionReceipt") {
    await world.holds.collateralReceipt?.promise;
    return;
  }
  if (msg.method === "eth_call") {
    const data = String((msg.params?.[0] as { data?: string })?.data ?? "");
    if (world.holds.accountRead && data.includes(TOKEN_OF_OWNER_SELECTOR.slice(2))) {
      await world.holds.accountRead.promise;
    }
    if (
      world.holds.positionsRead &&
      data.includes(GET_OPEN_POSITION_SELECTOR.slice(2))
    ) {
      await world.holds.positionsRead.promise;
    }
  }
}
```

In the route handler, immediately after `const parsed = JSON.parse(raw) …;` and before `const handleOne =`, add:

```ts
    for (const msg of Array.isArray(parsed) ? parsed : [parsed]) {
      await awaitHolds(world, msg);
    }
```

- [ ] **Step 4: Verify nothing regressed**

Run: `pnpm typecheck`
Expected: clean.

Run: `pnpm exec playwright test e2e/tier1 --reporter=line`
Expected: the full existing Tier-1 suite passes (63 tests) — holds are unarmed and the new faults unset, so behavior is unchanged.

- [ ] **Step 5: Commit**

```bash
git add e2e/support/world.ts e2e/support/chain.ts e2e/support/mockChain.ts
git commit -m "feat(e2e): hold-barrier + price/funding/candles/orders/trades faults"
```

---

### Task 2: D2 fix — validate the withdraw amount

`WithdrawDialog.onWithdraw` parses eagerly (`Margin.parse(amount)` at `WithdrawDialog.tsx:53`) before `mutate`, so a malformed amount throws uncaught in the click handler and renders no error. Fix by parsing inside the mutation (symmetric with `DepositDialog`, which passes the raw string into the SDK).

**Files:**
- Test: `e2e/tier1/03-deposit-withdraw.spec.ts`
- Modify: `src/features/account/WithdrawDialog.tsx`

- [ ] **Step 1: Write the failing test** `[FIX]`

Append inside `test.describe("deposit & withdraw", …)`:

```ts
  test("a malformed withdraw amount surfaces an error and sends no tx", async ({
    page,
    world,
  }) => {
    const { market, withdraw } = await enterTerminal(page, world); // $5,000
    await market.openWithdraw();
    await withdraw.amountInput.fill("abc"); // non-numeric → submit is enabled (non-empty)

    await expect(withdraw.submitButton).toBeEnabled();
    await withdraw.submitButton.click();

    // The error renders (not an uncaught throw), nothing is sent, margin holds.
    await expect(withdraw.error).toBeVisible();
    await expect(market.margin).toHaveText(/\$5,000\.00/);
    expect(world.lastCollateralDelta).toBe(0n);
  });
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm exec playwright test e2e/tier1/03-deposit-withdraw.spec.ts -g "malformed withdraw" --reporter=list`
Expected: FAIL — `withdraw-error` never appears (the parse throws synchronously and is swallowed by Playwright as a page error).

- [ ] **Step 3: Apply the fix**

In `src/features/account/WithdrawDialog.tsx`, change the mutation's payload type and `mutationFn`, and stop parsing in the handler:

```ts
  const withdraw = useTransactionMutation<
    `0x${string}`,
    { accountId: bigint; amount: string }
  >({
    transactionType: "WITHDRAW",
    // Parse INSIDE the mutation so a malformed amount rejects the mutation (→
    // `withdraw.error`, rendered below) instead of throwing uncaught in the
    // click handler. Symmetric with DepositDialog, which hands the raw string to
    // the SDK and lets it parse asynchronously.
    mutationFn: ({ accountId, amount }) =>
      onchain.deposit.modifyCollateral(accountId, 0n, -Margin.parse(amount)),
    invalidateKeys: wallet
      ? [{ queryKey: liqQueryKeys.account.margin(networkId, wallet) }]
      : [],
    onTransactionSuccess: () => {
      setAmount("");
      onClose();
    },
  });
```

And:

```ts
  function onWithdraw() {
    if (accountId === undefined || !amount) return;
    withdraw.mutate({ accountId, amount });
  }
```

**Fallback** (only if Step 4 still fails because `useTransactionMutation` does not turn a synchronous `mutationFn` throw into `withdraw.error`): keep the eager parse but guard it with local error state. Add `const [parseError, setParseError] = useState<string | null>(null);`, set it in a `try/catch` around `Margin.parse` in `onWithdraw` (returning early on catch), and render `{(parseError || withdraw.error) && (<p data-testid="withdraw-error">{parseError ?? withdraw.error?.message}</p>)}`. Clear `parseError` on a successful parse.

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm exec playwright test e2e/tier1/03-deposit-withdraw.spec.ts -g "malformed withdraw" --reporter=list`
Expected: PASS. Then run the whole file to confirm no regression:
`pnpm exec playwright test e2e/tier1/03-deposit-withdraw.spec.ts --reporter=line`

- [ ] **Step 5: Commit**

```bash
git add src/features/account/WithdrawDialog.tsx e2e/tier1/03-deposit-withdraw.spec.ts
git commit -m "fix(account): validate withdraw amount so a bad input shows an error, not an uncaught throw"
```

---

### Task 3: D3 — surface a reverted deposit (liqcx/monorepo#434)

A reverted deposit currently renders nothing (the SDK's `useDepositMutation` lets the revert escape as an unhandled rejection). The deposit mutation is SDK-owned (`@liqcx/liq-*`, not editable here), so this task **investigates** whether an in-repo change can surface it, fixes if it can, and otherwise pins the stable outcome and updates the existing NOTE.

**Files:**
- Test: `e2e/tier1/03-deposit-withdraw.spec.ts`
- Modify: `src/features/account/DepositDialog.tsx`

- [ ] **Step 1: Make the deposit reject handled, regardless of outcome**

In `DepositDialog.tsx`, add an `onError` to the `mutate` options so a revert can never be an *unhandled* rejection:

```ts
    deposit.mutate(
      { amount, accountId },
      {
        onSuccess: () => {
          setAmount("");
          onClose();
        },
        // Revert/asynchronous failures surface via `deposit.error` (rendered
        // below). An explicit handler also prevents an unhandled rejection.
        onError: () => {},
      },
    );
```

- [ ] **Step 2: Write the test asserting the strongest deterministic outcome** `[FIX]`

Add this test (it asserts the stable, always-true outcome; the `deposit.error` assertion is the *goal* — keep it if Step 4 shows the error renders):

```ts
  test("a reverted deposit leaves margin unchanged and surfaces the failure", async ({
    page,
    world,
  }) => {
    const { market, deposit } = await enterTerminal(page, world, () => {
      const w = readyWorld();
      w.accounts[0].available = 0n;
      w.accounts[0].withdrawable = 0n;
      return w;
    });
    world.faults.collateralReverts = true;

    await market.openDeposit();
    await expect(deposit.root).toBeVisible();
    await deposit.deposit("200");

    // Deterministic outcome: no margin moved, no collateral delta recorded.
    await expect(market.margin).toHaveText(/\$0\.00/);
    expect(world.lastCollateralDelta).toBe(0n);
    // GOAL: the revert is now visible to the user.
    await expect(deposit.error).toBeVisible();
  });
```

- [ ] **Step 3: Run — observe whether `deposit-error` renders**

Run: `pnpm exec playwright test e2e/tier1/03-deposit-withdraw.spec.ts -g "reverted deposit" --reporter=list`

- [ ] **Step 4: Branch on the result**

- **If it PASSES** (the `onError` handler caused `deposit.error` to populate): done — the bug is fixed in-repo. Delete the stale NOTE comment block at `03-deposit-withdraw.spec.ts:51-55` (the deposit revert is now asserted).
- **If it FAILS only on `await expect(deposit.error).toBeVisible()`** (margin/delta assertions passed → the SDK genuinely swallows the revert and never sets `deposit.error`): the full fix requires an SDK change. Remove the `deposit.error` line from the test, and replace the old NOTE at `03-deposit-withdraw.spec.ts:51-55` with:

```ts
  // NOTE: liqcx/monorepo#434 — the SDK's deposit mutation does not surface a
  // reverted modifyCollateral as `deposit.error` (unlike withdraw). The in-repo
  // mitigation (an explicit onError) prevents the unhandled rejection; the full
  // error-UI fix needs an SDK change. This test pins the stable outcome.
```

- [ ] **Step 5: Run the whole file + commit**

Run: `pnpm exec playwright test e2e/tier1/03-deposit-withdraw.spec.ts --reporter=line`
Expected: PASS.

```bash
git add src/features/account/DepositDialog.tsx e2e/tier1/03-deposit-withdraw.spec.ts
git commit -m "fix(account): handle a reverted deposit (no unhandled rejection) + cover the outcome"
```

---

### Task 4: Remove dead `useOrderMode`

**Files:**
- Delete: `src/features/auth/useOrderMode.ts`

- [ ] **Step 1: Confirm zero importers**

Run: `grep -rn "useOrderMode" src/`
Expected: only `src/features/auth/useOrderMode.ts` itself (its definition). If any other file imports it, STOP — it is not dead; report instead of deleting.

- [ ] **Step 2: Delete the file**

```bash
git rm src/features/auth/useOrderMode.ts
```

- [ ] **Step 3: Verify the build is intact**

Run: `pnpm typecheck`
Expected: clean (no dangling import).

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(auth): remove unused useOrderMode hook (dead code)"
```

---

### Task 5: Unit test for the gateway-URL boot guard (A5)

`config/env.ts`'s `requireGatewayUrl()` throws at module load on a blank `VITE_GATEWAY_URL` and strips a trailing slash. e2e cannot reach this (Vite always boots with a valid URL), so cover it with vitest.

**Files:**
- Create: `src/config/__tests__/env.test.ts`

- [ ] **Step 1: Write the test** `[CHAR]`

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env gateway-url guard", () => {
  it("throws at load when VITE_GATEWAY_URL is blank", async () => {
    vi.stubEnv("VITE_GATEWAY_URL", "");
    vi.resetModules();
    await expect(import("../env")).rejects.toThrow(/VITE_GATEWAY_URL is not set/);
  });

  it("strips a trailing slash from the gateway URL", async () => {
    vi.stubEnv("VITE_GATEWAY_URL", "https://gw.example.com/v1/");
    vi.resetModules();
    const { env } = await import("../env");
    expect(env.gatewayUrl).toBe("https://gw.example.com/v1");
  });
});
```

- [ ] **Step 2: Run — expect PASS**

Run: `pnpm test`
Expected: PASS (5 unit files now). If the blank-URL case does not reject, the guard regressed — report it.

- [ ] **Step 3: Commit**

```bash
git add src/config/__tests__/env.test.ts
git commit -m "test(config): cover the VITE_GATEWAY_URL boot guard (throw + slash strip)"
```

---

### Task 6: D1 — dialog backdrop close

**Files:**
- Modify: `src/components/ui/Dialog.tsx`
- Modify: `e2e/pages/TerminalPanels.ts`
- Test: `e2e/tier1/03-deposit-withdraw.spec.ts`

- [ ] **Step 1: Add the overlay testid**

In `src/components/ui/Dialog.tsx`, add `data-testid="dialog-overlay"` to the full-screen backdrop div (the `fixed inset-0 …` element with `onClick={onClose}`). Leave the inner panel's `stopPropagation` as-is.

- [ ] **Step 2: Add the locator**

In `e2e/pages/TerminalPanels.ts`, add to the `DepositDialog` class (and `WithdrawDialog` if you prefer symmetry — one is enough since the overlay is shared):

```ts
  readonly overlay: Locator;
```

and in its constructor:

```ts
    this.overlay = page.getByTestId("dialog-overlay");
```

- [ ] **Step 3: Write the test** `[FIX]` (fails first: locator missing)

```ts
  test("clicking the dialog backdrop closes it; clicking inside does not", async ({
    page,
    world,
  }) => {
    const { market, deposit } = await enterTerminal(page, world);
    await market.openDeposit();
    await expect(deposit.root).toBeVisible();

    // Click inside the panel — dialog stays open (stopPropagation).
    await deposit.root.getByText("Deposit USDC").click();
    await expect(deposit.root).toBeVisible();

    // Click the backdrop (top-left corner, outside the panel) — dialog closes.
    await deposit.overlay.click({ position: { x: 5, y: 5 } });
    await expect(deposit.root).toBeHidden();
    expect(world.lastCollateralDelta).toBe(0n);
  });
```

- [ ] **Step 4: Run — expect PASS** (after the testid + locator exist)

Run: `pnpm exec playwright test e2e/tier1/03-deposit-withdraw.spec.ts -g "backdrop" --reporter=list`
Expected: PASS. If the panel-click closes the dialog, `stopPropagation` is broken — report it.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Dialog.tsx e2e/pages/TerminalPanels.ts e2e/tier1/03-deposit-withdraw.spec.ts
git commit -m "test(e2e): dialog backdrop closes, panel click does not (D1) + overlay testid"
```

---

### Task 7: D4 — deposit/withdraw pending state (hold-barrier)

**Files:**
- Test: `e2e/tier1/03-deposit-withdraw.spec.ts`

- [ ] **Step 1: Write the two tests** `[FIX]` (need Task 1's hold-barrier)

```ts
  test("the deposit button shows a pending state while the tx is in flight", async ({
    page,
    world,
  }) => {
    const { market, deposit } = await enterTerminal(page, world, () => {
      const w = readyWorld();
      w.accounts[0].available = 0n;
      w.accounts[0].withdrawable = 0n;
      return w;
    });
    armHold(world, "collateralReceipt"); // hold the receipt → mutation stays pending

    await market.openDeposit();
    await deposit.deposit("200");

    await expect(deposit.submitButton).toHaveText(/Depositing…/);
    await expect(deposit.submitButton).toBeDisabled();

    releaseHold(world, "collateralReceipt");
    await expect(deposit.root).toBeHidden(); // settles + closes on success
    await expect(market.margin).toHaveText(/\$200\.00/);
  });

  test("the withdraw button shows a pending state while the tx is in flight", async ({
    page,
    world,
  }) => {
    const { market, withdraw } = await enterTerminal(page, world); // $5,000
    armHold(world, "collateralReceipt");

    await market.openWithdraw();
    await withdraw.withdraw("100");

    await expect(withdraw.submitButton).toHaveText(/Withdrawing…/);
    await expect(withdraw.submitButton).toBeDisabled();

    releaseHold(world, "collateralReceipt");
    await expect(withdraw.root).toBeHidden();
    await expect(market.margin).toHaveText(/\$4,900\.00/);
  });
```

Add `armHold, releaseHold` to the import from `../support/world`.

- [ ] **Step 2: Run — expect PASS**

Run: `pnpm exec playwright test e2e/tier1/03-deposit-withdraw.spec.ts -g "pending state" --reporter=list`
Expected: PASS. (If the button never shows `Depositing…`, the mutation does not wait for the receipt — investigate before adjusting.)

- [ ] **Step 3: Commit**

```bash
git add e2e/tier1/03-deposit-withdraw.spec.ts
git commit -m "test(e2e): deposit/withdraw pending state via the hold-barrier (D4)"
```

---

### Task 8: T1/T2/T6 — order payload wiring (acceptablePrice / triggerAbove)

Assert the form actually wires the computed fields into the POST body. `world.price` is `70_000·WAD`, `SLIPPAGE_BPS = 50n` → BUY `acceptablePrice = 70_350·WAD`, SELL `= 69_650·WAD`.

**Files:**
- Test: `e2e/tier1/04-trade-market.spec.ts`
- Test: `e2e/tier1/05-trade-limit.spec.ts`
- Test: `e2e/tier1/06-trade-conditional.spec.ts`

- [ ] **Step 1: T1 — market acceptablePrice** `[CHAR]` (in `04-trade-market.spec.ts`)

Add (reuse the file's existing imports; add `WAD` to the `../support/world` import and ensure `expect.poll` is available via the `expect` import):

```ts
  test("a market order carries the slippage-guarded acceptablePrice", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);

    await trade.setSize("0.5"); // BUY (default side)
    await trade.submit();
    await expect.poll(() => world.submittedOrders.length).toBeGreaterThan(0);
    expect(world.submittedOrders.at(-1)?.acceptablePrice).toBe(
      ((70_000n * WAD * 10_050n) / 10_000n).toString(), // mark + 0.5%
    );

    await trade.sideShort.click();
    await trade.setSize("0.5");
    await trade.submit();
    await expect.poll(() => world.submittedOrders.length).toBeGreaterThan(1);
    expect(world.submittedOrders.at(-1)?.acceptablePrice).toBe(
      ((70_000n * WAD * 9_950n) / 10_000n).toString(), // mark − 0.5%
    );
  });
```

- [ ] **Step 2: T2 — limit acceptablePrice equals limitPrice** `[CHAR]` (in `05-trade-limit.spec.ts`)

```ts
  test("a limit order sends acceptablePrice equal to the limit price", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    await trade.selectTab("limit");
    await trade.setSize("1");
    await trade.setLimitPrice("65000");
    await trade.submit();

    await expect.poll(() => world.submittedOrders.length).toBeGreaterThan(0);
    const order = world.submittedOrders.at(-1)!;
    expect(order.limitPrice).toBe(Price.parse("65000").toString());
    expect(order.acceptablePrice).toBe(Price.parse("65000").toString());
  });
```

Add `import { Price } from "@liq/sdk";` if not present.

- [ ] **Step 3: T6 — conditional omits acceptablePrice** `[CHAR]` (in `06-trade-conditional.spec.ts`)

```ts
  test("a conditional order omits acceptablePrice and carries triggerAbove", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    await trade.selectTab("stop");
    await trade.setSize("1");
    await trade.setTriggerPrice("80000");
    await trade.submit();

    await expect.poll(() => world.submittedOrders.length).toBeGreaterThan(0);
    const order = world.submittedOrders.at(-1)!;
    expect(order.acceptablePrice).toBeUndefined();
    expect(order.triggerAbove).toBeDefined();
  });
```

- [ ] **Step 4: Run all three — expect PASS**

Run: `pnpm exec playwright test e2e/tier1/04-trade-market.spec.ts e2e/tier1/05-trade-limit.spec.ts e2e/tier1/06-trade-conditional.spec.ts --reporter=line`
Expected: PASS. If a key name differs in the POST body (e.g. the SDK renames `triggerAbove`), the fail-first reveals it — adjust the asserted key to the real body, do not drop the assertion.

- [ ] **Step 5: Commit**

```bash
git add e2e/tier1/04-trade-market.spec.ts e2e/tier1/05-trade-limit.spec.ts e2e/tier1/06-trade-conditional.spec.ts
git commit -m "test(e2e): assert acceptablePrice/triggerAbove wiring in submitted orders (T1/T2/T6)"
```

---

### Task 9: T3 — empty price silently no-ops the submit

Submit is gated only on size/margin/markPrice, not price — so with a valid size and a blank Limit/Stop price the button is enabled, the click hits the `Price.parse` `catch`, and nothing is sent.

**Files:**
- Test: `e2e/tier1/05-trade-limit.spec.ts`
- Test: `e2e/tier1/06-trade-conditional.spec.ts`

- [ ] **Step 1: T3a — limit with no price** `[CHAR]` (in `05-trade-limit.spec.ts`)

```ts
  test("a limit submit with a blank price is enabled but sends nothing", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    await trade.selectTab("limit");
    await trade.setSize("1"); // valid size, price left blank

    await expect(trade.submitButton).toBeEnabled();
    await trade.submit();

    // Give any async submit a chance, then assert none happened.
    await expect(trade.tradeError).toBeHidden();
    expect(world.submittedOrders.length).toBe(0);
  });
```

- [ ] **Step 2: T3b — stop with no trigger** `[CHAR]` (in `06-trade-conditional.spec.ts`)

```ts
  test("a stop submit with a blank trigger is enabled but sends nothing", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    await trade.selectTab("stop");
    await trade.setSize("1"); // trigger left blank

    await expect(trade.submitButton).toBeEnabled();
    await trade.submit();

    await expect(trade.tradeError).toBeHidden();
    expect(world.submittedOrders.length).toBe(0);
  });
```

- [ ] **Step 3: Run — expect PASS**

Run: `pnpm exec playwright test e2e/tier1/05-trade-limit.spec.ts e2e/tier1/06-trade-conditional.spec.ts -g "blank" --reporter=list`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/tier1/05-trade-limit.spec.ts e2e/tier1/06-trade-conditional.spec.ts
git commit -m "test(e2e): blank limit/trigger price is a no-op submit (T3)"
```

---

### Task 10: T5 — trigger-direction default + toggle + submitted value

**Files:**
- Test: `e2e/tier1/06-trade-conditional.spec.ts`

- [ ] **Step 1: Write the test** `[CHAR]`

```ts
  test("the trigger direction defaults to ≥, toggles, and is submitted", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    await trade.selectTab("stop");

    // Default: Trigger ≥ is active.
    await expect(trade.triggerAbove).toHaveAttribute("aria-pressed", "true");
    await expect(trade.triggerBelow).toHaveAttribute("aria-pressed", "false");

    // Click ≤ — the pair flips (mutually exclusive).
    await trade.triggerBelow.click();
    await expect(trade.triggerAbove).toHaveAttribute("aria-pressed", "false");
    await expect(trade.triggerBelow).toHaveAttribute("aria-pressed", "true");

    await trade.setSize("1");
    await trade.setTriggerPrice("60000");
    await trade.submit();
    await expect.poll(() => world.submittedOrders.length).toBeGreaterThan(0);
    expect(world.submittedOrders.at(-1)?.triggerAbove).toBe(false);
  });
```

- [ ] **Step 2: Run — expect PASS**

Run: `pnpm exec playwright test e2e/tier1/06-trade-conditional.spec.ts -g "trigger direction" --reporter=list`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/tier1/06-trade-conditional.spec.ts
git commit -m "test(e2e): trigger-direction default, toggle, and submitted triggerAbove (T5)"
```

---

### Task 11: T4 — limit & conditional submit-error surfacing

Only MARKET submit-error is covered. Extend `12-errors` for the LIMIT and CONDITIONAL tabs (same `submitOrderStatus` fault; assert `trade-error` and that inputs are preserved).

**Files:**
- Test: `e2e/tier1/12-errors.spec.ts`

- [ ] **Step 1: Write the tests** `[CHAR]`

```ts
  test("a gateway 500 on a limit submit surfaces a trade error", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    world.faults.submitOrderStatus = 500;

    await trade.selectTab("limit");
    await trade.setSize("1");
    await trade.setLimitPrice("65000");
    await trade.submit();

    await expect(trade.tradeError).toBeVisible();
    await expect(trade.sizeInput).toHaveValue("1"); // not reset on failure
    await expect(trade.limitPriceInput).toHaveValue("65000");
  });

  test("a gateway 500 on a conditional submit surfaces a trade error", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    world.faults.submitOrderStatus = 500;

    await trade.selectTab("stop");
    await trade.setSize("1");
    await trade.setTriggerPrice("80000");
    await trade.submit();

    await expect(trade.tradeError).toBeVisible();
    await expect(trade.sizeInput).toHaveValue("1");
    await expect(trade.triggerPriceInput).toHaveValue("80000");
  });
```

- [ ] **Step 2: Run — expect PASS**

Run: `pnpm exec playwright test e2e/tier1/12-errors.spec.ts -g "limit submit|conditional submit" --reporter=list`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/tier1/12-errors.spec.ts
git commit -m "test(e2e): limit/conditional submit-error surfacing (T4)"
```

---

### Task 12: T7 — short-side trade preview

**Files:**
- Test: `e2e/tier1/14-trade-preview.spec.ts`

- [ ] **Step 1: Write the test** `[CHAR]`

```ts
  test("the preview renders for a short (negative sizeDelta)", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    await trade.sideShort.click();
    await trade.setSize("1");

    await expect(trade.preview).toBeVisible();
    await expect(trade.preview).toContainText("$70,000.00"); // notional, sign-independent
  });
```

(Confirm the notional label format against the existing long-side preview test in this file; match its exact assertion style.)

- [ ] **Step 2: Run — expect PASS**

Run: `pnpm exec playwright test e2e/tier1/14-trade-preview.spec.ts -g "short" --reporter=list`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/tier1/14-trade-preview.spec.ts
git commit -m "test(e2e): short-side trade preview renders (T7)"
```

---

### Task 13: P1a/P1b — orders & history list fetch-500 resilience

Add the gateway route handling for `ordersStatus`/`tradesStatus` (fields declared in Task 1) and assert a 500 leaves the terminal alive with an empty table — seeding rows first so the assertion is causal.

**Files:**
- Modify: `e2e/support/mockGateway.ts`
- Test: `e2e/tier1/12-errors.spec.ts`

- [ ] **Step 1: Write the failing tests** `[FIX]`

```ts
  test("an orders fetch failure leaves the terminal alive and the table empty", async ({
    page,
    world,
  }) => {
    const { app, userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ openOrders: [limitOrderFixture()] }),
    );
    world.faults.ordersStatus = 500;
    await userInfo.selectTab("open-orders");

    await expect(app.terminal).toBeVisible();
    await expect(userInfo.orderRow("ord-limit-1")).toBeHidden();
    await expect(userInfo.ordersEmpty).toBeVisible();
  });

  test("a trades fetch failure leaves the terminal alive and the table empty", async ({
    page,
    world,
  }) => {
    const { app, userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ trades: [tradeFixture()] }),
    );
    world.faults.tradesStatus = 500;
    await userInfo.selectTab("history");

    await expect(app.terminal).toBeVisible();
    await expect(userInfo.tradeRow("fill-1")).toBeHidden();
    await expect(userInfo.historyEmpty).toBeVisible();
  });
```

Add `tradeFixture` to the `../support/world` import.

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm exec playwright test e2e/tier1/12-errors.spec.ts -g "fetch failure" --reporter=list`
Expected: FAIL — the fault is ignored, so the seeded rows render.

- [ ] **Step 3: Wire the faults in `mockGateway.ts`**

In the `GET list` branch of `/orders` (after `const status = url.searchParams.get("status");`), before the `send`:

```ts
      if (world.faults.ordersStatus) {
        await error(route, world.faults.ordersStatus);
        return;
      }
```

In the `/trades` branch, before its `send`:

```ts
    if (path.endsWith("/trades")) {
      if (world.faults.tradesStatus) {
        await error(route, world.faults.tradesStatus);
        return;
      }
      await send(route, world.trades);
      return;
    }
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm exec playwright test e2e/tier1/12-errors.spec.ts -g "fetch failure" --reporter=list`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/support/mockGateway.ts e2e/tier1/12-errors.spec.ts
git commit -m "test(e2e): orders/history list fetch-500 resilience (P1a/P1b)"
```

---

### Task 14: M1/M2/M6 — price / funding / candles fetch states

`priceStatus` → header price `—`; `fundingStatus` → funding `—`; `candlesStatus` → chart empty-but-alive.

**Files:**
- Modify: `e2e/support/mockGateway.ts`
- Test: `e2e/tier1/02-market-data.spec.ts`

- [ ] **Step 1: Write the failing tests** `[FIX]` (in `02-market-data.spec.ts`)

```ts
  test("a price fetch failure shows an em-dash, markets still loaded", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    world.faults.priceStatus = 500;
    const app = new AppPage(page);
    await app.goto();
    await app.signInToTerminal();

    const market = new MarketHeaderPanel(page);
    await expect(market.price).toContainText("—");
    await expect(market.marketSelect).toContainText("BTC"); // markets loaded
  });

  test("a funding fetch failure shows an em-dash", async ({ page, world }) => {
    seed(world, readyWorld());
    world.faults.fundingStatus = 500;
    const app = new AppPage(page);
    await app.goto();
    await app.signInToTerminal();

    await expect(new MarketHeaderPanel(page).funding).toContainText("—");
  });

  test("a candles fetch failure leaves the chart mounted and terminal usable", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    world.faults.candlesStatus = 500;
    const app = new AppPage(page);
    await app.goto();
    await app.signInToTerminal();

    await expect(app.terminal).toBeVisible();
    await expect(page.locator("canvas").first()).toBeVisible();
    await expect(new MarketHeaderPanel(page).price).toContainText("$70,000");
  });
```

Ensure the file imports `AppPage`, `MarketHeaderPanel`, `seed`, `readyWorld` (mirror the existing imports in `02-market-data.spec.ts`; add any missing).

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm exec playwright test e2e/tier1/02-market-data.spec.ts -g "fetch failure" --reporter=list`
Expected: FAIL — faults ignored, values render normally.

- [ ] **Step 3: Wire the faults in `mockGateway.ts`**

In the `price` match branch, before its `send`:

```ts
    if (price) {
      if (world.faults.priceStatus) {
        await error(route, world.faults.priceStatus);
        return;
      }
      await send(route, {
        price: world.price.toString(),
        timestamp: 1_717_200_000_000,
      });
      return;
    }
```

In the `funding` branch:

```ts
    if (funding) {
      if (world.faults.fundingStatus) {
        await error(route, world.faults.fundingStatus);
        return;
      }
      await send(route, world.funding);
      return;
    }
```

In the `candles` branch:

```ts
    if (candles) {
      if (world.faults.candlesStatus) {
        await error(route, world.faults.candlesStatus);
        return;
      }
      await send(route, world.candlesByMarket?.[candles[1]] ?? world.candles);
      return;
    }
```

(The `candlesByMarket` fallback also lands here — used by Task 15.)

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm exec playwright test e2e/tier1/02-market-data.spec.ts -g "fetch failure" --reporter=list`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/support/mockGateway.ts e2e/tier1/02-market-data.spec.ts
git commit -m "test(e2e): price/funding/candles fetch states (M1/M2/M6)"
```

---

### Task 15: M5/M4 — single-market count + market-switch chart re-subscribe

**Files:**
- Test: `e2e/tier1/02-market-data.spec.ts`

- [ ] **Step 1: M5 — exactly one option** `[CHAR]`

```ts
  test("a single-market list renders exactly one option", async ({
    page,
    world,
  }) => {
    const { market } = await enterTerminal(page, world); // default readyWorld → 1 market
    await expect(market.marketSelect.locator("option")).toHaveCount(1);
  });
```

- [ ] **Step 2: M4 — switch re-subscribes the candle channel** `[FIX]` (needs Task 14's `candlesByMarket` fallback)

```ts
  test("switching market re-subscribes the chart to the new candle channel", async ({
    page,
    world,
  }) => {
    const { market } = await enterTerminal(page, world, () => {
      const w = readyWorld({ markets: [MARKET, MARKET_ETH] });
      // Distinct per-market candles so the redraw is observable.
      w.candlesByMarket = {
        [MARKET.id]: w.candles,
        [MARKET_ETH.id]: w.candles.map((c, i) => ({
          ...c,
          close: (3_000n * WAD + BigInt(i) * WAD).toString(),
        })),
      };
      return w;
    });

    await market.marketSelect.selectOption(MARKET_ETH.id);
    await expect
      .poll(() =>
        world.sseConnections.some((chs) =>
          chs.some((c) => c.includes(`candles:${MARKET_ETH.id}:1m`)),
        ),
      )
      .toBe(true);
  });
```

Add `MARKET, MARKET_ETH, WAD` to the `../support/constants` / `../support/world` imports as appropriate (check where `MARKET_ETH` is exported — `e2e/support/constants.ts`; `WAD` is in constants too).

- [ ] **Step 3: Run — expect PASS**

Run: `pnpm exec playwright test e2e/tier1/02-market-data.spec.ts -g "single-market|re-subscribes" --reporter=list`
Expected: PASS. (If `MARKET_ETH` does not exist in constants, define it there mirroring `MARKET` with `id:"201"`, `symbol:"ETH"`, `maxLeverage:50` — but first grep; the audit referenced it as existing.)

- [ ] **Step 4: Commit**

```bash
git add e2e/tier1/02-market-data.spec.ts e2e/support/constants.ts
git commit -m "test(e2e): single-market option count + market-switch candle re-subscribe (M5/M4)"
```

---

### Task 16: P2b/P2c/P2d — open-orders display branches

**Files:**
- Test: `e2e/tier1/09-orders-cancel.spec.ts`

Cells (0-indexed): Market=0, Type=1, Side=2, Size=3, Price=4, Status=5.

- [ ] **Step 1: Write the tests** `[CHAR]`

```ts
  test("order rows show their status, abs size, and an em-dash for no price", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({
        openOrders: [limitOrderFixture()],
        conditionalOrders: [
          conditionalOrderFixture(), // SELL, sizeDelta = -WAD, triggerPrice 80k
          conditionalOrderFixture({ id: "ord-noprice", triggerPrice: null }),
        ],
      }),
    );
    await userInfo.selectTab("open-orders");

    // P2b: Status cell.
    await expect(userInfo.orderRow("ord-limit-1")).toContainText("PENDING");
    await expect(userInfo.orderRow("ord-cond-1")).toContainText("TRIGGER_PENDING");

    // P2c: conditional Size renders abs(-1) = 1.
    await expect(userInfo.orderRow("ord-cond-1").locator("td").nth(3)).toHaveText("1");

    // P2d: a null-price conditional renders an em-dash in the Price cell.
    await expect(userInfo.orderRow("ord-noprice").locator("td").nth(4)).toHaveText("—");
  });
```

Add `conditionalOrderFixture` to the `../support/world` import.

- [ ] **Step 2: Run — expect PASS**

Run: `pnpm exec playwright test e2e/tier1/09-orders-cancel.spec.ts -g "status, abs size" --reporter=list`
Expected: PASS. If a cell index is off, fix the `nth(...)` to match the real column order (count the `<td>`s in `OpenOrdersTable.tsx`).

- [ ] **Step 3: Commit**

```bash
git add e2e/tier1/09-orders-cancel.spec.ts
git commit -m "test(e2e): open-orders status/abs-size/no-price display branches (P2b/P2c/P2d)"
```

---

### Task 17: P3a — cancel a conditional order

**Files:**
- Test: `e2e/tier1/09-orders-cancel.spec.ts`

- [ ] **Step 1: Write the test** `[CHAR]` (the DELETE handler already filters `conditionalOrders`)

```ts
  test("cancelling a conditional order removes its row", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ conditionalOrders: [conditionalOrderFixture()] }),
    );
    await userInfo.selectTab("open-orders");
    await expect(userInfo.orderRow("ord-cond-1")).toBeVisible();

    await userInfo.cancelOrder("ord-cond-1");

    await expect(userInfo.ordersEmpty).toBeVisible();
    expect(world.cancelledOrderIds).toContain("ord-cond-1");
  });
```

- [ ] **Step 2: Run — expect PASS**

Run: `pnpm exec playwright test e2e/tier1/09-orders-cancel.spec.ts -g "cancelling a conditional" --reporter=list`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/tier1/09-orders-cancel.spec.ts
git commit -m "test(e2e): cancel a conditional (TRIGGER_PENDING) order (P3a)"
```

---

### Task 18: P3b — SSE → CANCELLED removes the row

**Files:**
- Test: `e2e/tier1/11-live-sse.spec.ts`

- [ ] **Step 1: Write the test** `[CHAR]` (`applySseEffects` removes any non-OPEN status; `sseOrderUpdateFrame` takes any status)

```ts
  test("a CANCELLED order_update over SSE clears the order", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ openOrders: [limitOrderFixture()] }),
    );
    await userInfo.selectTab("open-orders");
    await expect(userInfo.orderRow("ord-limit-1")).toBeVisible();

    world.sseFrames = [sseOrderUpdateFrame("ord-limit-1", "CANCELLED")];
    await expect(userInfo.ordersEmpty).toBeVisible();
  });
```

Mirror the existing MATCHED test's imports (`sseOrderUpdateFrame`, `limitOrderFixture` from `../support/world`).

- [ ] **Step 2: Run — expect PASS**

Run: `pnpm exec playwright test e2e/tier1/11-live-sse.spec.ts -g "CANCELLED" --reporter=list`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/tier1/11-live-sse.spec.ts
git commit -m "test(e2e): SSE CANCELLED frame clears the order row (P3b)"
```

---

### Task 19: P2a/P3c — positions loading skeleton + tab aria

**Files:**
- Modify: `e2e/pages/TerminalPanels.ts`
- Test: `e2e/tier1/08-positions.spec.ts`

- [ ] **Step 1: Add the `positionsLoading` locator**

In `UserInfoPanel` (`TerminalPanels.ts`), add:

```ts
  get positionsLoading(): Locator {
    return this.page.getByTestId("positions-loading");
  }
```

- [ ] **Step 2: P2a — loading skeleton via hold-barrier** `[FIX]`

```ts
  test("the positions tab shows a loading skeleton while the read is in flight", async ({
    page,
    world,
  }) => {
    armHold(world, "positionsRead");
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({
        accounts: [
          {
            id: 1n,
            orderMode: "BOOK",
            available: 5_000n * WAD,
            withdrawable: 5_000n * WAD,
            positions: [longPositionFixture()],
          },
        ],
      }),
    );
    await userInfo.selectTab("positions");

    await expect(userInfo.positionsLoading).toBeVisible();
    releaseHold(world, "positionsRead");
    await expect(userInfo.positionRow(MARKET.id)).toBeVisible();
  });
```

Imports: `armHold, releaseHold, longPositionFixture, WAD` from `../support/world`, `MARKET` from `../support/constants` (mirror the file's existing imports).

NOTE: `enterTerminal` runs `signInToTerminal`, which reads the account during onboarding — arm the hold *after* sign-in if the onboarding account read collides with the positions read. If the onboard path stalls, move `armHold` to just before `selectTab("positions")` and assert the skeleton then. Confirm during TDD which placement isolates the positions read cleanly.

- [ ] **Step 3: P3c — tab active styling** `[CHAR]`

```ts
  test("the selected user-info tab is marked active", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world);
    await userInfo.selectTab("open-orders");

    await expect(userInfo.tab("open-orders")).toHaveAttribute("aria-pressed", "true");
    await expect(userInfo.tab("positions")).toHaveAttribute("aria-pressed", "false");
  });
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm exec playwright test e2e/tier1/08-positions.spec.ts -g "loading skeleton|marked active" --reporter=list`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/pages/TerminalPanels.ts e2e/tier1/08-positions.spec.ts
git commit -m "test(e2e): positions loading skeleton (hold-barrier) + tab aria-pressed (P2a/P3c)"
```

---

### Task 20: A1/A7 — session-loading gate + connect rejection

**Files:**
- Modify: `e2e/support/injectedWallet.ts`
- Test: `e2e/tier1/01-onboarding.spec.ts`

- [ ] **Step 1: Wire the `connectRejects` wallet fault**

In `injectedWallet.ts`, in the `eth_requestAccounts` case, before `state.connected = true;`:

```ts
        case "eth_requestAccounts":
          if (world.faults.connectRejects) {
            throw new Error("User rejected the request");
          }
          state.connected = true;
          return [TEST_ADDRESS.toLowerCase()];
```

- [ ] **Step 2: A1 — session-loading gate via hold-barrier** `[FIX]`

In `01-onboarding.spec.ts` (inside the existing describe), add:

```ts
  test("the session shows a loading gate while the account lookup is in flight", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    armHold(world, "accountRead"); // hold the tokenOfOwnerByIndex read
    const app = new AppPage(page);
    await app.goto();
    await app.connect();

    await expect(app.loadingGate).toBeVisible();
    releaseHold(world, "accountRead");
    await expect(app.needsSigninGate).toBeVisible();
  });
```

- [ ] **Step 3: A7 — connect rejection** `[FIX]`

```ts
  test("a rejected connect leaves the app on the connect screen", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    world.faults.connectRejects = true;
    const app = new AppPage(page);
    await app.goto();

    await app.connectButton.first().click(); // not app.connect() — it won't connect
    await expect(app.disconnectedGate).toBeVisible();
    await expect(app.terminal).toBeHidden();
  });
```

Ensure `01-onboarding.spec.ts` imports `armHold, releaseHold, readyWorld` from `../support/world` and `seed` from `../support/fixtures` (mirror existing imports).

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm exec playwright test e2e/tier1/01-onboarding.spec.ts -g "loading gate|rejected connect" --reporter=list`
Expected: PASS. (If `loadingGate` never appears, the account read isn't going through `tokenOfOwnerByIndex` under this scenario — verify the gated selector is actually issued; the substring match in `mockChain.awaitHolds` is the place to debug.)

- [ ] **Step 5: Commit**

```bash
git add e2e/support/injectedWallet.ts e2e/tier1/01-onboarding.spec.ts
git commit -m "test(e2e): session-loading gate (hold-barrier) + connect-rejection (A1/A7)"
```

---

### Task 21: Full verification + draft PR

**Files:** none (verification + PR).

- [ ] **Step 1: Full unit + type + lint**

Run: `pnpm test` → all vitest green (5 files).
Run: `pnpm typecheck` → clean.
Run: `pnpm lint` → clean. (Fix any lint nit inline and amend the nearest commit.)

- [ ] **Step 2: Full Tier-1 suite**

Run: `pnpm exec playwright test e2e/tier1 --reporter=line`
Expected: all green — ~90 tests (63 prior + ~27 new). Record the exact count.

- [ ] **Step 3: Confirm Tier-2 is untouched (no live run needed)**

Run: `pnpm exec playwright test --config e2e/tier2/playwright.live.config.ts --list`
Expected: the live specs are collected unchanged (no new/edited Tier-2 files in this round).

- [ ] **Step 4: Push + open a draft PR**

```bash
git push -u origin feat-cld/e2e-coverage-round2
gh pr create --draft --base main \
  --title "test(e2e): round-2 coverage — P0+P1 gap closure + D2/D3 fixes" \
  --body "Closes the audit's P0+P1 e2e gaps (~27 Tier-1 tests), fixes D2 (withdraw input validation) and D3 (deposit-revert handling), removes dead useOrderMode, and adds a unit test for the gateway-URL boot guard. Spec: docs/superpowers/specs/2026-06-08-e2e-coverage-round2-design.md. Plan: docs/superpowers/plans/2026-06-08-e2e-coverage-round2.md.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 5: Final commit (if any verification fix-ups remain)**

```bash
git add -A
git commit -m "test(e2e): round-2 verification fix-ups"
git push
```

---

## Self-review notes

- **Spec coverage:** Every P0+P1 row in the spec's inventory maps to a task — T1/T2/T6→8, T3→9, T5→10, T4→11, T7→12, P2b/c/d→16, P3a→17, P3b→18, P3c+P2a→19, M5/M4→15, M1/M2/M6→14, P1a/P1b→13, D1→6, D4→7, A1/A7→20, A5→5, D2→2, D3→3, dead-code→4. Infra foundation (hold-barrier + faults)→1. Verification/PR→21.
- **Deferred items** (Section 4 of the spec: A2, A3, A6, A8, D5, D6, M3, M8, P3d, P3e, T8, T9) are intentionally **not** tasks.
- **Placeholder scan:** none — every code step is complete; the two genuinely conditional points (D2 fallback, D3 branch) carry full code for each branch, not a TODO.
- **Type consistency:** `armHold(world, name)`/`releaseHold(world, name)`, `world.holds`, the fault fields (`priceStatus`/`fundingStatus`/`candlesStatus`/`ordersStatus`/`tradesStatus`/`connectRejects`), `candlesByMarket`, and the gated selectors (`TOKEN_OF_OWNER_SELECTOR`/`GET_OPEN_POSITION_SELECTOR`) are defined in Task 1 and used consistently thereafter.
