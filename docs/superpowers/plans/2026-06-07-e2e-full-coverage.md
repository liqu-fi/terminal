# E2E Full Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every functional e2e-coverage gap in the terminal: 13 new Tier 1 (hermetic) tests + the mock-infra they need, and 3 new Tier 2 (live staging) specs.

**Architecture:** Tier 1 tests run a real Vite dev server with all I/O intercepted in-process: `e2e/support/world.ts` is the single mutable state ("MockWorld") that the injected EIP-1193 wallet, the mock JSON-RPC chain, and the mock gateway all close over. Tests seed the world, drive the UI through Page Objects (`e2e/pages/`), and assert both UI state and recorded world mutations. Tier 2 reuses the same Page Objects against real staging with a mnemonic-derived wallet. This plan extends the world/wallet/gateway mocks (switchable chainId, trade-preview contract reads, `/orders/nonce`, candle SSE frames, new faults), then adds specs file-by-file.

**Tech Stack:** Playwright 1.60, viem, TypeScript. Spec: `docs/superpowers/specs/2026-06-07-e2e-full-coverage-design.md`. Branch: `feat-cld/e2e-full-coverage`.

**Conventions (apply to every task):**
- Run Tier 1 specs with `pnpm exec playwright test e2e/tier1/<file> --reporter=list` from the repo root. The config auto-starts Vite on port 5173 (override with `E2E_PORT` if 5173 is occupied by a stray server).
- A "new test FAILS first" step means: the assertion fails because the feature is unmocked/locator missing — NOT a compile error in unrelated code. If you see an unrelated error, stop and investigate.
- Commit after every green task. Messages follow the repo's `test(e2e): …` / `feat(e2e): …` style.

---

### Task 1: Switchable wallet chainId + wrong-chain gate specs

The injected wallet always reports chainId 6343 today, so `SessionGate`'s wrong-chain stage (added in `12a3a67`) is unreachable in tests. Make the chain switchable and reject-able, record signature requests (used later by Task 8), and cover the gate with 2 tests.

**Files:**
- Modify: `e2e/support/world.ts`
- Modify: `e2e/support/injectedWallet.ts`
- Modify: `e2e/pages/AppPage.ts`
- Test: `e2e/tier1/01-onboarding.spec.ts`

- [ ] **Step 1: Write the two failing tests**

Append inside the existing `test.describe("boot + onboarding", …)` block of `e2e/tier1/01-onboarding.spec.ts`:

```ts
  test("a wallet on a foreign chain is gated until it switches to MegaETH", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    world.chainId = 1; // wallet sits on Ethereum mainnet, not MegaETH
    const app = new AppPage(page);
    await app.goto();
    await app.connect();

    // Gated: neither create-account nor sign-in is reachable on the wrong chain.
    await expect(app.wrongChainGate).toBeVisible();
    await expect(app.needsSigninGate).toBeHidden();

    // Switching chains advances to the SIWE step (the account exists), then
    // sign-in lands in the terminal — the full recovery path.
    await app.switchChainButton.click();
    await expect(app.needsSigninGate).toBeVisible();
    expect(world.chainId).toBe(6343); // the wallet actually switched
    await app.signIn();
    await expect(app.terminal).toBeVisible();
  });

  test("a rejected chain switch surfaces the error and stays gated", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    world.chainId = 1;
    world.faults.switchChainRejects = true;
    const app = new AppPage(page);
    await app.goto();
    await app.connect();
    await expect(app.wrongChainGate).toBeVisible();

    await app.switchChainButton.click();
    // The rejection is surfaced inline (no silent dead button) and the gate holds.
    await expect(app.switchChainError).toBeVisible();
    await expect(app.wrongChainGate).toBeVisible();
    expect(world.chainId).toBe(1); // the wallet never moved
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `pnpm exec playwright test e2e/tier1/01-onboarding.spec.ts --reporter=list`
Expected: the 6 existing tests pass; the 2 new ones FAIL (TypeScript error on `world.chainId` / missing `wrongChainGate` locator). If TS blocks the run entirely, that counts as the RED step — proceed.

- [ ] **Step 3: Extend MockWorld**

In `e2e/support/world.ts`:

3a. Add two fields to `interface MockWorld` (after `wallet: string;`):

```ts
  /** Chain the injected wallet reports (eth_chainId / net_version); mutable —
   * wallet_switchEthereumChain rewrites it and emits chainChanged. */
  chainId: number;
```

3b. Inside the `faults:` block, after `collateralReverts?: boolean;`:

```ts
    // wallet: reject the next wallet_switchEthereumChain / every eth_sendTransaction
    switchChainRejects?: boolean;
    walletSendRejects?: boolean;
```

3c. In the recordings section, after `registeredAccountIds: string[];`:

```ts
  /** Signing methods the wallet performed (personal_sign, eth_signTypedData_v4, …). */
  signRequests: string[];
```

3d. In `freshWorld()`'s returned object add (next to `wallet: TEST_ADDRESS,`):

```ts
    chainId: 6343,
```

and (next to `registeredAccountIds: [],`):

```ts
    signRequests: [],
```

- [ ] **Step 4: Make the injected wallet honor world.chainId and the new faults**

In `e2e/support/injectedWallet.ts`:

4a. Replace the `eth_chainId` / `net_version` cases:

```ts
        case "eth_chainId":
          return numberToHex(world.chainId);
        case "net_version":
          return String(world.chainId);
```

(`CHAIN_ID_HEX` may become unused — if so, remove it from the import.)

4b. Replace the signing cases (record before returning):

```ts
        case "personal_sign":
        case "eth_sign":
        case "eth_signTypedData":
        case "eth_signTypedData_v4":
          world.signRequests.push(method);
          return DUMMY_SIG;
```

4c. At the top of the `eth_sendTransaction` case add:

```ts
          if (world.faults.walletSendRejects) {
            throw new Error("User rejected the request");
          }
```

4d. Replace the combined `wallet_switchEthereumChain` / `wallet_addEthereumChain` case with:

```ts
        case "wallet_switchEthereumChain": {
          if (world.faults.switchChainRejects) {
            throw new Error("User rejected the request");
          }
          const target = (params[0] ?? {}) as { chainId?: string };
          if (target.chainId) world.chainId = Number.parseInt(target.chainId, 16);
          return null;
        }
        case "wallet_addEthereumChain":
          return null;
```

4e. In the init script, make `request` async and emit `chainChanged` after a successful switch (wagmi re-reads the chain from this event). Replace the `request:` property of the page-side `provider` object with:

```ts
        request: async ({
          method,
          params,
        }: {
          method: string;
          params?: unknown[];
        }) => {
          const result = await (
            window as unknown as {
              __e2eWalletRequest: (m: string, p: unknown[]) => Promise<unknown>;
            }
          ).__e2eWalletRequest(method, params ?? []);
          // A successful chain switch must notify wagmi exactly like a real
          // wallet does; a rejected one threw above and emits nothing.
          if (method === "wallet_switchEthereumChain") {
            const target = (params?.[0] ?? {}) as { chainId?: string };
            if (target.chainId)
              for (const fn of listeners["chainChanged"] ?? []) fn(target.chainId);
          }
          return result;
        },
```

- [ ] **Step 5: Add the AppPage locators**

In `e2e/pages/AppPage.ts`, add to the class fields (after `disconnectedGate`):

```ts
  readonly wrongChainGate: Locator;
  readonly switchChainButton: Locator;
  readonly switchChainError: Locator;
```

and to the constructor (after the `disconnectedGate` assignment):

```ts
    this.wrongChainGate = page.getByTestId("session-wrong-chain");
    this.switchChainButton = page.getByTestId("switch-chain-button");
    this.switchChainError = page.getByTestId("switch-chain-error");
```

- [ ] **Step 6: Run the file until green**

Run: `pnpm exec playwright test e2e/tier1/01-onboarding.spec.ts --reporter=list`
Expected: all 8 tests PASS. Known wrinkle: if the first new test hangs on `needsSigninGate` after the switch click, wagmi did not observe `chainChanged` — verify step 4e emits on the page side (not the Node side) and that the listener array key is exactly `"chainChanged"`.

- [ ] **Step 7: Commit**

```bash
git add e2e/support/world.ts e2e/support/injectedWallet.ts e2e/pages/AppPage.ts e2e/tier1/01-onboarding.spec.ts
git commit -m "test(e2e): cover the wrong-chain gate (switchable wallet chainId + chainChanged)"
```

---

### Task 2: create-account-error spec

`SessionGate` surfaces a failed create-account mutation via an ErrorLine (`create-account-error`); nothing covers it. Uses `faults.walletSendRejects` from Task 1.

**Files:**
- Modify: `e2e/pages/AppPage.ts`
- Test: `e2e/tier1/01-onboarding.spec.ts`

- [ ] **Step 1: Write the failing test**

Append inside the `test.describe` block of `e2e/tier1/01-onboarding.spec.ts`:

```ts
  test("a rejected create-account tx surfaces the error and recovers on retry", async ({
    page,
    world,
  }) => {
    // default freshWorld: connected wallet, no perps account
    const app = new AppPage(page);
    await app.goto();
    await app.connect();
    await expect(app.noAccountGate).toBeVisible();

    world.faults.walletSendRejects = true;
    await app.createAccountButton.click();
    // The wallet rejection lands in the ErrorLine — not a silent dead button.
    await expect(app.createAccountError).toBeVisible();
    await expect(app.noAccountGate).toBeVisible(); // still gated
    expect(world.accounts).toHaveLength(0); // nothing was minted

    delete world.faults.walletSendRejects;
    await app.createAccountButton.click();
    await expect(app.needsSigninGate).toBeVisible({ timeout: 25_000 });
    expect(world.accounts).toHaveLength(1);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec playwright test e2e/tier1/01-onboarding.spec.ts --reporter=list`
Expected: FAIL on the missing `createAccountError` locator (TS error).

- [ ] **Step 3: Add the locator**

In `e2e/pages/AppPage.ts` add the field (after `createAccountButton`):

```ts
  readonly createAccountError: Locator;
```

and in the constructor (after the `createAccountButton` assignment):

```ts
    this.createAccountError = page.getByTestId("create-account-error");
```

- [ ] **Step 4: Run until green**

Run: `pnpm exec playwright test e2e/tier1/01-onboarding.spec.ts --reporter=list`
Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/pages/AppPage.ts e2e/tier1/01-onboarding.spec.ts
git commit -m "test(e2e): assert the create-account ErrorLine surfaces a rejected tx"
```

---

### Task 3: Debug-overlay spec

The `wallet-debug` and `signin-debug` overlays are permanent integrator diagnostics (commit `12a3a67`); assert they render and that `wallet-debug` cannot intercept clicks (`pointer-events: none` — the actual mechanism that keeps the fixed overlay harmless).

**Files:**
- Modify: `e2e/pages/AppPage.ts`
- Test: `e2e/tier1/01-onboarding.spec.ts`

- [ ] **Step 1: Write the failing test**

Append inside the `test.describe` block of `e2e/tier1/01-onboarding.spec.ts`:

```ts
  test("integrator debug overlays render and never intercept clicks", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    const app = new AppPage(page);
    await app.goto();
    // The wallet overlay is up from boot and is click-transparent by CSS —
    // that property is exactly what keeps it from blocking the app's CTAs.
    await expect(app.walletDebug).toBeVisible();
    await expect(app.walletDebug).toHaveCSS("pointer-events", "none");

    await app.connect();
    // The sign-in stage shows the auth-state JSON dump.
    await expect(app.signinDebug).toBeVisible();
    await expect(app.signinDebug).toContainText('"status"');
    // …and the CTA underneath the fixed overlay still works end-to-end.
    await app.signIn();
    await expect(app.terminal).toBeVisible();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec playwright test e2e/tier1/01-onboarding.spec.ts --reporter=list`
Expected: FAIL on the missing `walletDebug` / `signinDebug` locators (TS error).

- [ ] **Step 3: Add the locators**

In `e2e/pages/AppPage.ts` add fields (after `signinError`):

```ts
  readonly walletDebug: Locator;
  readonly signinDebug: Locator;
```

constructor (after the `signinError` assignment):

```ts
    this.walletDebug = page.getByTestId("wallet-debug");
    this.signinDebug = page.getByTestId("signin-debug");
```

- [ ] **Step 4: Run until green**

Run: `pnpm exec playwright test e2e/tier1/01-onboarding.spec.ts --reporter=list`
Expected: all 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/pages/AppPage.ts e2e/tier1/01-onboarding.spec.ts
git commit -m "test(e2e): pin the debug overlays (visible, pointer-events none)"
```

---

### Task 4: Withdraw gating + dialog-cancel specs

Mirror the existing deposit-side tests; no infra needed (`WithdrawDialog` gates on `!amount` exactly like deposit).

**Files:**
- Test: `e2e/tier1/03-deposit-withdraw.spec.ts`

- [ ] **Step 1: Write the two tests**

Append inside the `test.describe("deposit & withdraw", …)` block:

```ts
  test("withdraw submit is gated on a non-empty amount", async ({
    page,
    world,
  }) => {
    const { market, withdraw } = await enterTerminal(page, world);
    await market.openWithdraw();

    await expect(withdraw.submitButton).toBeDisabled(); // empty
    await withdraw.amountInput.fill("50");
    await expect(withdraw.submitButton).toBeEnabled();
    await withdraw.amountInput.fill("");
    await expect(withdraw.submitButton).toBeDisabled(); // cleared again
    expect(world.lastCollateralDelta).toBe(0n); // nothing was ever sent
  });

  test("cancelling the withdraw dialog closes it without sending a tx", async ({
    page,
    world,
  }) => {
    const { market, withdraw } = await enterTerminal(page, world);
    await market.openWithdraw();
    await expect(withdraw.root).toBeVisible();
    await withdraw.amountInput.fill("100"); // even with an amount entered…

    await withdraw.cancelButton.click();
    await expect(withdraw.root).toBeHidden(); // …cancel just dismisses
    expect(world.lastCollateralDelta).toBe(0n); // no collateral tx was sent
  });
```

- [ ] **Step 2: Run the file**

Run: `pnpm exec playwright test e2e/tier1/03-deposit-withdraw.spec.ts --reporter=list`
Expected: all 7 tests PASS immediately (the UI behavior already exists; these tests pin it).

- [ ] **Step 3: Commit**

```bash
git add e2e/tier1/03-deposit-withdraw.spec.ts
git commit -m "test(e2e): withdraw-side gating + dialog-cancel symmetry"
```

---

### Task 5: `/orders/nonce` mock + nonce seed/recovery spec (#443)

The SDK 0.27 added order-nonce sync: on auth it GETs `/orders/nonce` and `syncNonce`s the store (monotonic max over a timestamp-derived initial ≈1.8e15), and on a 422 `INVALID_NONCE` with `details.expected` it resyncs and auto-retries once (`withNonceRetry`). The mock gateway serves neither — `/orders/nonce` falls into the single-order regex and returns `null` (silently swallowed). Mock both and pin the behavior.

**Files:**
- Modify: `e2e/support/world.ts`
- Modify: `e2e/support/mockGateway.ts`
- Test: `e2e/tier1/04-trade-market.spec.ts`

- [ ] **Step 1: Write the failing test**

Append inside the `test.describe("market orders", …)` block of `e2e/tier1/04-trade-market.spec.ts`:

```ts
  test("seeds the order nonce from the gateway and recovers from INVALID_NONCE (#443)", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    // The client store boots with a timestamp-derived nonce (~1.8e15); the
    // gateway seed is higher, so after the sync lands the FIRST submit must
    // carry exactly the server value — proving the seed, not the local guess.
    await expect.poll(() => world.orderNonceRequests).toBeGreaterThan(0);

    await trade.setSize("0.5");
    await trade.submit();
    await expect.poll(() => world.submittedOrders.length).toBe(1);
    expect(String(world.submittedOrders[0].nonce)).toBe("8888888888888888888");
    await expect(trade.sizeInput).toHaveValue(""); // confirmed submit resets

    // Now the gateway rejects the next nonce and names the one it expects:
    // the SDK must resync to it and retry the SAME order — with no surfaced
    // error and no user interaction.
    world.faults.submitNonceConflictExpected = "9000000000000000000";
    await trade.setSize("0.25");
    await trade.submit();
    await expect.poll(() => world.submittedOrders.length).toBe(3); // reject + retry
    expect(String(world.submittedOrders[1].nonce)).toBe("8888888888888888889");
    expect(String(world.submittedOrders[2].nonce)).toBe("9000000000000000000");
    await expect(trade.tradeError).toBeHidden(); // recovery, not failure
    await expect(trade.sizeInput).toHaveValue("");
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec playwright test e2e/tier1/04-trade-market.spec.ts --reporter=list`
Expected: the 2 existing tests pass; the new one FAILS (TS error on `orderNonceRequests` — or, once typed, `orderNonceRequests` stays 0 because the route is unmocked).

- [ ] **Step 3: Extend MockWorld**

In `e2e/support/world.ts`:

3a. Fields on `interface MockWorld` (recordings section, after `signRequests`):

```ts
  /** GET /orders/nonce — the seed the gateway hands the client, and a counter. */
  orderNonce: bigint;
  orderNonceRequests: number;
```

3b. In `faults:` (after `walletSendRejects?: boolean;`):

```ts
    // gateway: one-shot 422 INVALID_NONCE on the next POST /orders, naming
    // the expected nonce (drives the SDK's resync-and-retry path)
    submitNonceConflictExpected?: string;
```

3c. In `freshWorld()` (next to the other recording initializers):

```ts
    // Must exceed the SDK's timestamp-derived initial nonce (BigInt(Date.now())
    // * 1000n ≈ 1.8e15): syncNonce is monotonic-MAX, so a lower seed would be
    // invisible. 8.8e18 stays above it for centuries.
    orderNonce: 8_888_888_888_888_888_888n,
    orderNonceRequests: 0,
```

- [ ] **Step 4: Mock the routes**

In `e2e/support/mockGateway.ts`, immediately BEFORE the `// --- orders ---` block insert:

```ts
    // --- order nonce (must precede the order matchers: "/orders/nonce" would
    // otherwise be captured by the single-order regex as orderId="nonce") ----
    if (path.endsWith("/orders/nonce")) {
      world.orderNonceRequests += 1;
      await send(route, { nextNonce: world.orderNonce.toString() });
      return;
    }
```

Then, inside the `POST` branch of `/orders`, right AFTER `world.submittedOrders.push(payload);` and BEFORE the `submitOrderStatus` fault check, insert:

```ts
        // One-shot INVALID_NONCE conflict: reject THIS submit naming the nonce
        // the gateway expects (the real error envelope shape). Cleared on use,
        // so the SDK's automatic retry then succeeds.
        if (world.faults.submitNonceConflictExpected) {
          const expected = world.faults.submitNonceConflictExpected;
          delete world.faults.submitNonceConflictExpected;
          await route.fulfill({
            status: 422,
            contentType: "application/json",
            body: JSON.stringify({
              error: {
                code: "INVALID_NONCE",
                message: "invalid nonce",
                details: { expected },
              },
            }),
          });
          return;
        }
```

- [ ] **Step 5: Run until green**

Run: `pnpm exec playwright test e2e/tier1/04-trade-market.spec.ts --reporter=list`
Expected: all 3 tests PASS. If the first assertion sees a ~1.8e15 nonce instead of `8888888888888888888`, the submit raced the nonce sync — the `expect.poll` on `orderNonceRequests` should prevent this; if it persists, poll on the submitted value instead (`expect.poll(() => String(world.submittedOrders[0]?.nonce)).toBe(…)`).

- [ ] **Step 6: Commit**

```bash
git add e2e/support/world.ts e2e/support/mockGateway.ts e2e/tier1/04-trade-market.spec.ts
git commit -m "test(e2e): order-nonce gateway seed + INVALID_NONCE auto-retry (#443)"
```

---

### Task 6: Candle SSE frame + chart-subscription spec

`useCandles` streams closed 1m bars over the SSE channel `candles:{marketId}:1m`; nothing exercises it. Add a frame fixture + per-connection channel recording, and assert (a) the chart subscribes, (b) a streamed bar redraws the canvas (pixel-hash), (c) the app stays healthy.

**Files:**
- Modify: `e2e/support/world.ts`
- Modify: `e2e/support/mockGateway.ts`
- Test: `e2e/tier1/11-live-sse.spec.ts`

- [ ] **Step 1: Write the failing test**

Append inside the `test.describe("live SSE updates", …)` block of `e2e/tier1/11-live-sse.spec.ts` (the file already imports `WAD`; extend the `world` import with `sseCandleFrame`):

```ts
  test("the chart subscribes to 1m candles and redraws on a streamed bar", async ({
    page,
    world,
  }) => {
    const { app } = await enterTerminal(page, world);
    // The chart's channel is part of some SSE connection's channel set.
    await expect
      .poll(() =>
        world.sseConnections.some((c) => c.includes("candles:200:1m")),
      )
      .toBe(true);

    // Pixel-hash every canvas: a new bar far from the flat 70k history forces
    // an autoscale + redraw, so the hash MUST change when the bar lands.
    const canvasHash = () =>
      page.evaluate(() => {
        let h = 5381;
        for (const c of Array.from(document.querySelectorAll("canvas"))) {
          const s = (c as HTMLCanvasElement).toDataURL();
          for (let i = 0; i < s.length; i++)
            h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
        }
        return h;
      });
    await expect(page.locator("canvas").first()).toBeVisible({
      timeout: 15_000,
    });
    const before = await canvasHash();

    const lastTs = world.candles.at(-1)!.timestamp;
    const p80k = (80_000n * WAD).toString();
    world.sseFrames = [
      sseCandleFrame("200", {
        bucketStartTs: lastTs + 60,
        open: p80k,
        high: p80k,
        low: p80k,
        close: p80k,
        volume: WAD.toString(),
        tradeCount: 1,
        lastTradePrice: p80k,
      }),
    ];
    await expect.poll(() => world.sseFrames.length).toBe(0); // delivered
    await expect.poll(canvasHash, { timeout: 15_000 }).not.toBe(before);
    await expect(app.terminal).toBeVisible(); // still healthy
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec playwright test e2e/tier1/11-live-sse.spec.ts --reporter=list`
Expected: existing 4 tests pass; the new one FAILS (`sseConnections` / `sseCandleFrame` don't exist).

- [ ] **Step 3: Extend the world**

In `e2e/support/world.ts`:

3a. Field on `interface MockWorld` (next to `sseFrames: string[];`):

```ts
  /** channels query-param of every SSE connection the app opened. */
  sseConnections: string[][];
```

3b. In `freshWorld()` (next to `sseFrames: [],`):

```ts
    sseConnections: [],
```

3c. New fixture helper (next to `sseOrderUpdateFrame`):

```ts
/** A raw SSE frame carrying a CLOSED 1m candle bar on `candles:{id}:1m`. */
export function sseCandleFrame(
  marketId: string,
  bar: {
    bucketStartTs: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    tradeCount: number;
    lastTradePrice: string | null;
  },
): string {
  const event = {
    type: "candle",
    channel: `candles:${marketId}:1m`,
    data: bar,
  };
  return `data: ${JSON.stringify(event)}\n\n`;
}
```

- [ ] **Step 4: Record SSE channels in the mock gateway**

In `e2e/support/mockGateway.ts`, at the very top of the `if (path.endsWith("/sse")) {` branch (before `const frames = await sseLongPoll(world);`):

```ts
      world.sseConnections.push(
        (url.searchParams.get("channels") ?? "").split(","),
      );
```

- [ ] **Step 5: Run until green**

Run: `pnpm exec playwright test e2e/tier1/11-live-sse.spec.ts --reporter=list`
Expected: all 5 tests PASS.
**Fallback (only if the pixel-hash assertion proves flaky over ~3 runs):** drop the `canvasHash` comparison (keep the channel-subscription poll, the frame-consumed poll, and the healthy-terminal assertion) and leave a comment that bar-level math is covered by `src/features/chart/__tests__/candleMapping.test.ts`. Note the downgrade in the commit message.

- [ ] **Step 6: Commit**

```bash
git add e2e/support/world.ts e2e/support/mockGateway.ts e2e/tier1/11-live-sse.spec.ts
git commit -m "test(e2e): live 1m candle over SSE (channel subscribe + canvas redraw)"
```

---

### Task 7: Trade-preview contract reads + preview spec

`useTradePreview` multicalls 4 reads on `PerpsMarketProxy` (`getOrderFees`, `skew`, `fillPrice`, `getSettlementRewardCost`); the mock chain handles none, so the preview row has never rendered in a test. Fee math downstream: `notional = |sizeDelta·price|/1e18`; `sameSide = (notional>0) === (skew>0)` picks taker (else maker); `fee = notional·rate/1e18`; `impact = |fill−price|·10000/price` bps. With defaults below, a 1 BTC BUY @ $70k mark shows: Est. fill `70,000`, Fee `$42.00`, Price impact `0.00%`, Notional `$70,000.00`.

**Files:**
- Modify: `e2e/support/contracts.ts`
- Modify: `e2e/support/world.ts`
- Modify: `e2e/support/chain.ts`
- Modify: `e2e/pages/TerminalPanels.ts`
- Create: `e2e/tier1/14-trade-preview.spec.ts`

- [ ] **Step 1: Write the failing spec file**

Create `e2e/tier1/14-trade-preview.spec.ts`:

```ts
import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

test.describe("trade preview", () => {
  test("entering a size reveals fill, fee, impact and notional", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);
    await expect(trade.preview).toBeHidden(); // nothing to preview yet

    await trade.setSize("1");
    // 300ms debounce + onchain multicall, then the row appears:
    await expect(trade.preview).toBeVisible();
    // 1 BTC @ $70k mark, flat mock fill, positive default skew ⇒ BUY is taker:
    await expect(trade.preview).toContainText("Est. fill");
    await expect(trade.preview).toContainText("70,000"); // fill == mark
    await expect(trade.preview).toContainText("$42.00"); // 6bp taker fee
    await expect(trade.preview).toContainText("0.00%"); // zero impact
    await expect(trade.preview).toContainText("$70,000.00"); // notional
  });

  test("growing the size scales the preview", async ({ page, world }) => {
    const { trade } = await enterTerminal(page, world);
    await trade.setSize("1");
    await expect(trade.preview).toContainText("$70,000.00");

    await trade.setSize("2");
    await expect(trade.preview).toContainText("$140,000.00"); // notional ×2
    await expect(trade.preview).toContainText("$84.00"); // fee ×2
  });

  test("clearing the size hides the preview", async ({ page, world }) => {
    const { trade } = await enterTerminal(page, world);
    await trade.setSize("1");
    await expect(trade.preview).toBeVisible();

    await trade.setSize("");
    await expect(trade.preview).toBeHidden();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec playwright test e2e/tier1/14-trade-preview.spec.ts --reporter=list`
Expected: FAIL — `trade.preview` doesn't exist yet (TS error); after Step 5's locator it would still fail with the preview never appearing (multicall reads unhandled).

- [ ] **Step 3: Add the 4 ABI items**

In `e2e/support/contracts.ts`, inside `perpsMarketProxyAbi` after the `indexPrice` item (still in the `--- reads ---` section), add — these are copied verbatim from the `@liq/onchain` dist ABI so the selectors match exactly:

```ts
  {
    name: "getOrderFees",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint128" }],
    outputs: [
      { name: "makerFee", type: "uint256" },
      { name: "takerFee", type: "uint256" },
    ],
  },
  {
    name: "skew",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint128" }],
    outputs: [{ name: "", type: "int256" }],
  },
  {
    name: "fillPrice",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "marketId", type: "uint128" },
      { name: "orderSize", type: "int128" },
      { name: "price", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getSettlementRewardCost",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "marketId", type: "uint128" },
      { name: "settlementStrategyId", type: "uint128" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
```

- [ ] **Step 4: World fixtures + chain read handlers**

4a. In `e2e/support/world.ts`, fields on `interface MockWorld` (after `price: bigint;` / near the other market data):

```ts
  /** getOrderFees read — WAD fee ratios (default 2bp maker / 6bp taker). */
  orderFees: { maker: bigint; taker: bigint };
  /** Market skew read — positive by default so a BUY previews as the taker side. */
  skew: bigint;
```

In `freshWorld()` (next to `price,`):

```ts
    orderFees: { maker: 2n * 10n ** 14n, taker: 6n * 10n ** 14n },
    skew: WAD,
```

4b. In `e2e/support/chain.ts`, add cases to the `switch (name)` of `computeRead` (after the `indexPrice` case):

```ts
    case "getOrderFees": {
      return [world.orderFees.maker, world.orderFees.taker];
    }
    case "skew": {
      return [world.skew];
    }
    case "fillPrice": {
      // Fill == the caller-supplied price: a flat book with zero impact, so
      // preview assertions stay arithmetic (fee/notional) not market-model.
      return [args[2] as bigint];
    }
    case "getSettlementRewardCost": {
      return [0n];
    }
```

- [ ] **Step 5: TradePanel locator**

In `e2e/pages/TerminalPanels.ts`, add to `TradePanel` fields (after `tradeError`):

```ts
  readonly preview: Locator;
```

constructor (after the `tradeError` assignment):

```ts
    this.preview = page.getByTestId("trade-preview");
```

- [ ] **Step 6: Run until green**

Run: `pnpm exec playwright test e2e/tier1/14-trade-preview.spec.ts --reporter=list`
Expected: 3 PASS. If the row never appears, check the Playwright trace for the multicall eth_call — an `unhandled selector 0x…` error in the RPC response means an ABI item doesn't match the SDK's (re-extract from `node_modules/@liq/onchain/dist/index.js`).

- [ ] **Step 7: Run the neighbors (preview now renders inside them)**

Run: `pnpm exec playwright test e2e/tier1/04-trade-market.spec.ts e2e/tier1/05-trade-limit.spec.ts e2e/tier1/06-trade-conditional.spec.ts e2e/tier1/07-trade-gating.spec.ts --reporter=list`
Expected: all PASS — the preview row appearing in trade flows is additive; none of them assert its absence.

- [ ] **Step 8: Commit**

```bash
git add e2e/support/contracts.ts e2e/support/world.ts e2e/support/chain.ts e2e/pages/TerminalPanels.ts e2e/tier1/14-trade-preview.spec.ts
git commit -m "test(e2e): trade preview row (getOrderFees/skew/fillPrice reads in the mock chain)"
```

---

### Task 8: Session-persistence specs

The gateway store persists `{token, nextNonce}` to `localStorage['liq-gateway']` (zustand persist with a bigint reviver), and wagmi's default `reconnectOnMount` re-attaches the injected wallet (its Node-side `connected` closure survives `page.reload()`). A reload must therefore land back in the terminal with **no second SIWE**. Uses `signRequests` (Task 1) and `orderNonceRequests` (Task 5).

**Files:**
- Create: `e2e/tier1/15-session-persistence.spec.ts`

- [ ] **Step 1: Write the spec file**

Create `e2e/tier1/15-session-persistence.spec.ts`:

```ts
import { AppPage } from "../pages/AppPage";
import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

test.describe("session persistence", () => {
  test("a reload with a persisted JWT lands back in the terminal without a second SIWE", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    expect(world.authVerifyRequests).toHaveLength(1);
    const signs = world.signRequests.length;

    await page.reload();

    const app = new AppPage(page);
    // wagmi auto-reconnects the injected wallet; the JWT comes back from
    // localStorage('liq-gateway') — so the terminal returns with zero clicks…
    await expect(app.terminal).toBeVisible({ timeout: 25_000 });
    // …and crucially with no re-authentication of any kind:
    expect(world.authVerifyRequests).toHaveLength(1);
    expect(world.authNonceRequests).toBe(1);
    expect(world.signRequests.length).toBe(signs);
  });

  test("the order nonce re-syncs from the gateway after a reload", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    await expect.poll(() => world.orderNonceRequests).toBeGreaterThan(0);
    const before = world.orderNonceRequests;

    await page.reload();
    await expect(new AppPage(page).terminal).toBeVisible({ timeout: 25_000 });
    // The restored token re-arms useGatewayNonceSync — a fresh seed is fetched.
    await expect.poll(() => world.orderNonceRequests).toBeGreaterThan(before);
  });
});
```

- [ ] **Step 2: Run the file**

Run: `pnpm exec playwright test e2e/tier1/15-session-persistence.spec.ts --reporter=list`
Expected: 2 PASS.
**Fallback (only if the terminal never reappears after reload):** wagmi did not auto-reconnect in this environment. Insert after `await page.reload();` in BOTH tests:

```ts
    // wagmi did not auto-reconnect here — one connect click, still no SIWE:
    await app.connect();
```

(moving the `const app = new AppPage(page);` line above it in the first test, and using an explicit `const app` in the second). The no-second-SIWE assertions stay unchanged — they are the point of the test.

- [ ] **Step 3: Commit**

```bash
git add e2e/tier1/15-session-persistence.spec.ts
git commit -m "test(e2e): JWT + nonce persistence across reload (no second SIWE)"
```

---

### Task 9: Full Tier 1 verification

**Files:** none (verification only; fix-ups allowed anywhere under `e2e/`)

- [ ] **Step 1: Full hermetic run**

Run: `pnpm test:e2e`
Expected: **62 passed** (49 existing + 13 new), 0 failed. The suite runs fully parallel; the new tests must hold up under worker contention, not just in isolation.

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both clean.

- [ ] **Step 3: Re-run flaky candidates 3×**

Run: `pnpm exec playwright test e2e/tier1/11-live-sse.spec.ts e2e/tier1/15-session-persistence.spec.ts --repeat-each=3 --reporter=list`
Expected: all green. If the candle pixel-hash flakes here, apply the Task 6 fallback now.

- [ ] **Step 4: Commit any stabilization fix-ups**

```bash
git add -A e2e && git commit -m "test(e2e): stabilize tier1 suite at 62 tests" || echo "nothing to fix"
```

---

### Task 10: Tier 2 plumbing — onboarding flag + wallet-index fixture

**Files:**
- Modify: `e2e/tier2/env.ts`
- Modify: `e2e/tier2/liveFixtures.ts`
- Modify: `.env.e2e.example`

- [ ] **Step 1: Add the flag to LiveEnv**

In `e2e/tier2/env.ts`, add to `interface LiveEnv` (after `accountCount: number;` — note the stray `fillTimeoutMs` doc comment sits above it; keep your addition clear of it):

```ts
  /** Opt-in: run the cold-onboarding spec (mints an account NFT per run). */
  onboarding: boolean;
```

and to the `liveEnv` object (after `accountCount: …`):

```ts
  onboarding:
    process.env.E2E_LIVE_ONBOARDING === "1" ||
    process.env.E2E_LIVE_ONBOARDING === "true",
```

- [ ] **Step 2: Parameterize the wallet derivation index**

Replace the `test` export in `e2e/tier2/liveFixtures.ts` with:

```ts
export const test = base.extend<{ liveWalletIndex: number; liveWallet: void }>({
  /** Derivation index for the page's wallet — overridable per spec file
   * (the onboarding spec uses a fresh per-run index). */
  liveWalletIndex: [0, { option: true }],
  liveWallet: [
    async ({ page, liveWalletIndex }, use) => {
      if (liveConfigured().ok) {
        const account = mnemonicToAccount(liveEnv.mnemonic, {
          addressIndex: liveWalletIndex,
        });
        await installLiveWallet(page, account, liveEnv.rpcUrl, liveEnv.chainId);
      }
      await use();
    },
    { auto: true },
  ],
});
```

- [ ] **Step 3: Document the flag**

Append to `.env.e2e.example`:

```bash

# Opt-in: also run the cold-onboarding live spec. Each run derives a fresh
# wallet, funds its gas with a small ETH transfer from index 0, and MINTS A
# NEW SNX ACCOUNT NFT on staging — run deliberately, not by default.
E2E_LIVE_ONBOARDING=0
```

- [ ] **Step 4: Verify nothing regressed (specs skip without E2E_LIVE)**

Run: `pnpm test:e2e:live`
Expected: every live spec reports SKIPPED ("E2E_LIVE is not set"), exit code 0.

- [ ] **Step 5: Commit**

```bash
git add e2e/tier2/env.ts e2e/tier2/liveFixtures.ts .env.e2e.example
git commit -m "feat(e2e): E2E_LIVE_ONBOARDING flag + per-spec wallet derivation index"
```

---

### Task 11: live-conditional spec

**Files:**
- Create: `e2e/tier2/live-conditional.live.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { TradePanel, UserInfoPanel } from "../pages/TerminalPanels";
import { ensureTradeReady } from "./ensureTradeReady";
import { liveConfigured, liveEnv } from "./env";
import { expect, test } from "./liveFixtures";

test.describe("live: conditional orders", () => {
  test.describe.configure({ timeout: liveEnv.fillTimeoutMs + 120_000 });

  test.beforeEach(() => {
    const gate = liveConfigured();
    test.skip(!gate.ok, gate.reason);
  });

  test("places and cancels a stop-market trigger order", async ({ page }) => {
    await ensureTradeReady(page);
    const trade = new TradePanel(page);
    const userInfo = new UserInfoPanel(page);

    await trade.selectTab("stop");
    await trade.setSize("0.001");
    // Trigger far above any realistic BTC mark (triggerAbove defaults to true),
    // so conditional-svc never fires it — the order rests until we cancel it.
    await trade.setTriggerPrice("1000000");
    await expect(trade.submitButton).toBeEnabled({
      timeout: liveEnv.fillTimeoutMs,
    });
    await trade.submit();

    await userInfo.selectTab("open-orders");
    const rows = page.locator('[data-testid^="order-row-"]');
    await expect(rows.first()).toBeVisible({ timeout: liveEnv.fillTimeoutMs });
    const before = await rows.count();

    await page.locator('[data-testid^="cancel-order-"]').first().click();
    await expect(rows).toHaveCount(before - 1, {
      timeout: liveEnv.fillTimeoutMs,
    });
  });
});
```

- [ ] **Step 2: Verify it skips cleanly without config**

Run: `pnpm test:e2e:live`
Expected: the new spec is collected and SKIPPED; exit 0. (The live assertion run happens in Task 14.)

- [ ] **Step 3: Commit**

```bash
git add e2e/tier2/live-conditional.live.spec.ts
git commit -m "test(e2e): live conditional order place + cancel on staging"
```

---

### Task 12: live-deposit-withdraw spec

**Files:**
- Create: `e2e/tier2/live-deposit-withdraw.live.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import {
  DepositDialog,
  MarketHeaderPanel,
  WithdrawDialog,
} from "../pages/TerminalPanels";
import { ensureTradeReady } from "./ensureTradeReady";
import { liveConfigured, liveEnv } from "./env";
import { expect, test } from "./liveFixtures";

test.describe("live: deposit & withdraw", () => {
  // Two real on-chain txs (deposit + withdraw) — budget like the fill test.
  test.describe.configure({ timeout: liveEnv.fillTimeoutMs * 2 + 120_000 });

  test.beforeEach(() => {
    const gate = liveConfigured();
    test.skip(!gate.ok, gate.reason);
  });

  // Small round-trip: the withdraw returns the deposit, so reruns don't bleed
  // the pool wallet. Needs ≥$5 of fUSDC in the wallet (faucet `claim` refills).
  const AMOUNT = "5";

  test("deposits then withdraws the same amount round-trip", async ({
    page,
  }) => {
    await ensureTradeReady(page);
    const market = new MarketHeaderPanel(page);
    const margin = async () =>
      Number((await market.margin.textContent())!.replace(/[$,]/g, ""));

    const start = await margin();

    await market.openDeposit();
    const deposit = new DepositDialog(page);
    await deposit.deposit(AMOUNT);
    await expect(deposit.root).toBeHidden({ timeout: liveEnv.fillTimeoutMs });
    // Tolerant threshold (refresh timing / dust): the deposit must land.
    await expect
      .poll(margin, { timeout: liveEnv.fillTimeoutMs })
      .toBeGreaterThanOrEqual(start + 4.5);

    const funded = await margin();
    await market.openWithdraw();
    const withdraw = new WithdrawDialog(page);
    await withdraw.withdraw(AMOUNT);
    await expect(withdraw.root).toBeHidden({ timeout: liveEnv.fillTimeoutMs });
    await expect
      .poll(margin, { timeout: liveEnv.fillTimeoutMs })
      .toBeLessThanOrEqual(funded - 4.5);
  });
});
```

- [ ] **Step 2: Verify it skips cleanly without config**

Run: `pnpm test:e2e:live`
Expected: collected + SKIPPED, exit 0.

- [ ] **Step 3: Commit**

```bash
git add e2e/tier2/live-deposit-withdraw.live.spec.ts
git commit -m "test(e2e): live deposit/withdraw margin round-trip on staging"
```

---

### Task 13: Gas-funding helper + live-onboarding spec

**Files:**
- Create: `e2e/tier2/funding.ts`
- Create: `e2e/tier2/live-onboarding.live.spec.ts`

- [ ] **Step 1: Write the funding helper**

Create `e2e/tier2/funding.ts`:

```ts
/**
 * Gas funding for live specs: a small native-ETH transfer from the pool wallet
 * (derivation index 0) to a freshly derived address. The staging faucet only
 * dispenses fUSDC — gas has to come from the pool.
 */
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";

import { liveEnv } from "./env";

export async function fundGas(to: `0x${string}`, eth: string): Promise<void> {
  const chain = defineChain({
    id: liveEnv.chainId,
    name: "MegaETH Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [liveEnv.rpcUrl] } },
    testnet: true,
  });
  const funder = mnemonicToAccount(liveEnv.mnemonic, { addressIndex: 0 });
  const wallet = createWalletClient({
    account: funder,
    chain,
    transport: http(liveEnv.rpcUrl),
  });
  const pub = createPublicClient({ chain, transport: http(liveEnv.rpcUrl) });
  const hash = await wallet.sendTransaction({ to, value: parseEther(eth) });
  await pub.waitForTransactionReceipt({ hash });
}
```

- [ ] **Step 2: Write the onboarding spec**

Create `e2e/tier2/live-onboarding.live.spec.ts`:

```ts
import { mnemonicToAccount } from "viem/accounts";

import { AppPage } from "../pages/AppPage";
import { TradePanel } from "../pages/TerminalPanels";
import { liveConfigured, liveEnv } from "./env";
import { fundGas } from "./funding";
import { expect, test } from "./liveFixtures";

// A per-run derivation index far outside the pooled accounts (0…accountCount):
// every run onboards a genuinely fresh wallet. Module-load time is fine — the
// file is collected once per run.
const FRESH_INDEX = 100_000 + (Date.now() % 900_000);

test.use({ liveWalletIndex: FRESH_INDEX });

test.describe("live: cold onboarding", () => {
  test.describe.configure({ timeout: liveEnv.fillTimeoutMs * 2 + 120_000 });

  test.beforeEach(() => {
    const gate = liveConfigured();
    test.skip(!gate.ok, gate.reason);
    test.skip(
      !liveEnv.onboarding,
      "E2E_LIVE_ONBOARDING is not set (this spec mints an account NFT per run)",
    );
  });

  test("a fresh wallet onboards: create account → SIWE → empty terminal", async ({
    page,
  }) => {
    const fresh = mnemonicToAccount(liveEnv.mnemonic, {
      addressIndex: FRESH_INDEX,
    });
    await fundGas(fresh.address, "0.002"); // createAccount gas, from index 0

    const app = new AppPage(page);
    await app.goto();
    await app.connect();

    // A fresh derivation truly owns no account — the create CTA must show
    // (this is the dead-button onboarding path, live).
    await expect(app.noAccountGate).toBeVisible({
      timeout: liveEnv.fillTimeoutMs,
    });
    await app.createAccountButton.click();
    await expect(app.needsSigninGate).toBeVisible({
      timeout: liveEnv.fillTimeoutMs,
    });
    await app.signinButton.click();
    await expect(app.terminal).toBeVisible({ timeout: liveEnv.fillTimeoutMs });

    // Lands trade-blocked: zero margin, deposit hint up.
    await expect(new TradePanel(page).insufficientMargin).toBeVisible({
      timeout: liveEnv.fillTimeoutMs,
    });
  });
});
```

- [ ] **Step 3: Verify both skip paths**

Run: `pnpm test:e2e:live`
Expected: spec SKIPPED with "E2E_LIVE is not set". (With `E2E_LIVE=1` but no `E2E_LIVE_ONBOARDING`, it must skip with the onboarding message instead — verified live in Task 14.)

- [ ] **Step 4: Commit**

```bash
git add e2e/tier2/funding.ts e2e/tier2/live-onboarding.live.spec.ts
git commit -m "test(e2e): flagged live cold-onboarding spec (fresh wallet, pool-funded gas)"
```

---

### Task 14: Tier 2 live verification (needs staging secrets)

**Files:** none (verification; fix-ups in `e2e/tier2/` allowed)

- [ ] **Step 1: Load the live env**

The operator (Alex) provides `.env.e2e.local` (gitignored; built from `.env.e2e.example`, mnemonic from 1Password vault `perps`). Load it:

```bash
set -a; . ./.env.e2e.local; set +a
```

If the file does not exist, STOP and ask the user to provide it — do not invent credentials.

- [ ] **Step 2: Standard live run (onboarding stays skipped)**

Run: `pnpm test:e2e:live`
Expected: 6 tests run + 1 skipped (onboarding) — all green. Watch specifically:
- `live-conditional`: if the stop order *settles instead of resting* (memory: staging once pool-filled non-market orders — fixed in monorepo #433), the open-orders row never appears. If that happens, capture the gateway response from the trace, STOP, and report — that's a backend regression, not a test bug.
- `live-deposit-withdraw`: needs ≥$5 fUSDC in the pool wallet; if the deposit errors, claim from the faucet (`claim(token)` at `0xb633158863BA2f98e6ba14fe04E76A50004D4c6e`, staging fUSDC `0x7DDaF31739bcdd107ea52BBABe6BD6D1d7033f1B`, 24h cooldown) and rerun.

- [ ] **Step 3: One deliberate onboarding run**

Run: `E2E_LIVE_ONBOARDING=1 pnpm test:e2e:live -- --grep "cold onboarding"`
Expected: 1 passed (mints one NFT on staging — deliberate). The pool wallet (index 0) must hold ≥0.003 ETH for the gas transfer.

- [ ] **Step 4: Commit any live-run fix-ups**

```bash
git add -A e2e && git commit -m "test(e2e): stabilize tier2 live specs against staging" || echo "nothing to fix"
```

---

### Task 15: Final sweep + draft PR

**Files:** none new

- [ ] **Step 1: Full local gate**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`
Expected: typecheck clean, lint clean, unit tests green, e2e **62 passed**.

- [ ] **Step 2: Spec-vs-implementation check**

Re-read `docs/superpowers/specs/2026-06-07-e2e-full-coverage-design.md` section by section and confirm each promised test exists (13 Tier 1 across `01/03/04/11/14/15`, 3 Tier 2 specs, all infra items 1a–1f). Fix anything missing before the PR.

- [ ] **Step 3: Push + draft PR**

```bash
git push -u origin feat-cld/e2e-full-coverage
gh pr create --draft --base main --title "test(e2e): full functional coverage (tier1 gaps + tier2 expansion)" --body "$(cat <<'EOF'
## Summary
- Tier 1 (hermetic): 49 → 62 tests — wrong-chain gate, create-account ErrorLine, debug overlays, withdraw gating/cancel, order-nonce seed + INVALID_NONCE auto-retry (#443), live 1m candle over SSE, trade-preview row, JWT/nonce persistence across reload
- Mock infra: switchable wallet chainId (+chainChanged), walletSendRejects/switchChainRejects faults, sign-request recording, `/orders/nonce`, one-shot INVALID_NONCE fault, candle SSE frames + channel recording, getOrderFees/skew/fillPrice/getSettlementRewardCost reads
- Tier 2 (live, opt-in): +3 specs — conditional place+cancel, deposit/withdraw round-trip, cold onboarding behind `E2E_LIVE_ONBOARDING=1` (fresh wallet, pool-funded gas)

Design: `docs/superpowers/specs/2026-06-07-e2e-full-coverage-design.md`
Plan: `docs/superpowers/plans/2026-06-07-e2e-full-coverage.md`

## Test plan
- [ ] `pnpm test:e2e` → 62 passed
- [ ] `pnpm test:e2e:live` with staging creds → 6 passed, onboarding skipped
- [ ] `E2E_LIVE_ONBOARDING=1 pnpm test:e2e:live -- --grep "cold onboarding"` → 1 passed

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: draft PR URL printed.
