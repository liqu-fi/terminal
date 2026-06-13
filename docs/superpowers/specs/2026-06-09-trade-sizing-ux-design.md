# Trade sizing & money-input UX — design

**Date:** 2026-06-09
**Status:** approved
**Branch:** `feat-cld/terminal-sizing-ux`

## Problem

The reference terminal's order entry and deposit/withdraw flows are crude:

- **No way to choose "how much" to open.** `size-input` is a raw base-asset field; the
  leverage slider _overwrites_ size with "all available margin × leverage" — an opaque,
  surprising coupling with no notion of "open 25% of my buying power".
- **No input validation.** Money inputs are bare `<input inputMode="decimal">` — they accept
  letters, multiple dots, negatives. There is no min-size / max-leverage / over-margin check
  surfaced to the user, no max button, no balance awareness.
- Same in **Deposit / Withdraw**: bare inputs, no wallet/account balance shown, no Max, no
  validation that the amount is affordable.

Goal: a Binance/OKX-style order ticket and money dialogs — pick size as a %, see notional /
margin / liq-price live, can't type garbage, attach TP/SL on entry.

## Constraints

- **Preserve every existing `data-testid`** — they are the e2e locators (tier-1 mock + tier-2
  live). New controls get new testids.
- **Size default unit = base asset.** `setSize("0.5")` (tier-1 + tier-2) must keep meaning
  "0.5 base units" → `sizeDelta = Qty.parse("0.5")`. Tier-2 live specs use only `setSize` in
  base units; do not break them.
- **All money math via `@liq/core` brands** (`Price.mul/div`, `Qty`, `Margin`, `calcNotional`,
  `calcLeverage`, `calcLiquidationPrice`, `clampLeverage`, `MIN_MARGIN_AMOUNT`,
  `APP_MAX_LEVERAGE`) — never hand-rolled WAD arithmetic in components.
- Neutral, forkable style preserved (Tailwind design tokens).

## Decisions

- **Leverage and size are decoupled** (Binance model). The leverage slider sets leverage only
  (drives margin/liq math and the buying-power ceiling); it no longer writes `size`. Size is set
  by the percentage control or by typing.
- **Percentage slider starts at 0 / size empty** — no full-position prefill from a stray click.
- **% basis = buying power** = `available × leverage`. `Max` / 100% = full buying power.
- **Withdraw Max** = `margins.withdrawable` (SDK). **Deposit Max** = wallet sUSDC balance
  (`useBalancesQuery([PerpsMarketProxy])`), best-effort (hidden if the read is unavailable, e.g.
  unmocked in tier-1).
- **TP/SL on entry** is best-effort: after the entry order is accepted, submit reduce-only
  conditional orders (not atomic with entry). Documented as a simplification.

## Components

### `components/ui/DecimalInput.tsx` (new)
Controlled numeric input wrapping the visual `Input`. Sanitizes every change to
`/^\d*\.?\d{0,maxDecimals}$/` (digits + at most one dot, no sign, bounded fraction; empties
stay empty). Props: `value`, `onValueChange(string)`, `maxDecimals`, optional `rightSlot`
(unit toggle / Max button), `invalid` → `aria-invalid`. Used by SizeField, limit/trigger
fields, TP/SL fields, deposit, withdraw.

### `features/trade/orderMath.ts` (extend; keep existing exports)
Pure, unit-tested helpers (no React):
- `maxSizeQty({ availableUsd, leverage, markPrice }): bigint` — buying-power ceiling in base
  units (generalises existing `leverageToSize`; that export stays for back-compat tests).
- `pctToSize(pct, maxSize)`, `sizeToPct(size, maxSize)` — 0–100 ⇄ base qty (clamped).
- `usdToSize(usdWad, markPrice)`, `sizeToUsd(sizeWad, markPrice)` — via `Price.mul/div`.
- `marginCost(notionalWad, leverage)` — `notional / leverage`.
- `validateOrder(input): { ok: boolean; reason?: string }` — ordered checks: no mark price,
  empty/zero size, `size < minSize`, `leverage > maxLeverage`, `marginCost > available`.
  Reason string drives the submit button label / inline message.

### `features/trade/useOrderSizing.ts` (new hook)
Owns the interlinked sizing state (`sizeStr`, `unit: 'base'|'usd'`, `pct`, `leverage`) and
exposes derived values (`sizeQty`, `notional`, `marginCost`, `liqPrice`, `maxSizeQty`,
`validation`). Inputs: `available`, `markPrice`, `side`, market (`minSize`, `maxLeverage`,
`maintenanceMarginFraction`). Setting one of {pct, typed size, unit, leverage} reconciles the
rest. Keeps `TradeForm` lean.

### `features/trade/SizeField.tsx` (new)
`DecimalInput` carrying `size-input` (base by default) + unit toggle `size-unit-toggle`
(base ⇄ USD) + `size-max-button`.

### `features/trade/SizePercent.tsx` (new)
Range slider `size-pct-slider` (0–100) + chips `size-pct-25|50|75|100`.

### `features/trade/EntryTpSlFields.tsx` (new)
`tpsl-toggle` reveals `entry-tp-input` + `entry-sl-input` (DecimalInputs). Shown on Market /
Limit tabs only.

### `features/trade/TradeForm.tsx` (rewire)
Tabs → side → SizeField → SizePercent → leverage (decoupled) → limit/trigger (existing) →
optional TP/SL → summary rows (Notional · Margin · Liq) + existing `trade-preview` → submit
(label = validation reason when invalid). On submit success: reset size + pct; fire TP/SL
conditionals if set.

### `features/account/DepositDialog.tsx` / `WithdrawDialog.tsx` (extend)
Balance line (`deposit-balance` / `withdraw-balance`) + `*-max-button`, `DecimalInput`, inline
validation (`*-validation`) for `amount ≤ balance` and `> 0`. Deposit error/revert behaviour
(#434) and withdraw debt → atomic repay+withdraw (#459/#453) preserved.

## Tests

- **Unit (vitest):** extend `orderMath.test.ts` (maxSizeQty, pctToSize/sizeToPct, usd⇄size,
  marginCost, validateOrder branches); add `DecimalInput` sanitization test.
- **e2e tier-1:** update **07-trade-gating** (leverage decoupled — moving it no longer fills
  size; % slider / Max / chips set size; submit reason text); update **03-deposit-withdraw**
  (the "abc → error" case becomes "non-numeric is sanitized / blocked"; keep empty-gating,
  cancel, pending, debt cases). Extend page objects (`setSizePct`, `clickMax`, `setUnit`,
  balance getters). **Tier-2 untouched.**
- **Gates:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

## Out of scope

Layout/positions/history redesign; theme changes; orderbook depth; cross-margin UI.
