# Ф5b: долги контура на проводе — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** терминал перестаёт угадывать там, где SDK 0.46.0 научился отвечать —
плечо рынка, ордер в полёте, слово предупреждения.

**Architecture:** правок ровно столько, сколько мест угадывало. Ничего нового не
заводим: три ответа уже есть в `@liq/core` (`maxLeverageFromBps`,
`IN_FLIGHT_ORDER_STATUSES`/`isInFlight`, `describeWarning`), и работа — снять
локальные подмены и подключить их.

**Tech Stack:** React 19, TanStack Query/Table, zustand, shadcn/ui, `@liq/*` 0.46.0.

**Spec:** `docs/superpowers/specs/2026-09-01-trade-core-design.md`
**Парная фаза:** `liqcx/monorepo` PR #731 (Ф5a), релиз `liq@0.46.0`.

## Global Constraints

- Пакеты `@liq/*` пинятся как `npm:@liqpro/liq-*@^0.46.0` — все восемь одной версией.
- Логику берём из `liq-*`, свою не пишем; UI — radix-ui + shadcn/ui.
- Гейт фазы: `pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build && pnpm test:e2e`.
  `pnpm lint` **не использовать** — резолвится в чужой глобальный ESLint 9.
- Живой ярус (`pnpm test:e2e:live`) запускается отдельно и о пропусках сообщается честно.

---

### Задача 1: SDK 0.46.0 в зависимостях

**Files:** Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Шаг 1:** восемь строк `@liq/*` перевести на `^0.46.0`, `pnpm install`.
- [ ] **Шаг 2:** `pnpm typecheck` — ожидается КРАСНЫЙ: `market.minSize` и
      `market.maxLeverage` исчезли из `MarketSummary`. Список ошибок — карта задач 2.
- [ ] **Шаг 3:** коммит `chore(deps): @liq/* 0.46.0`.

### Задача 2: тикет читает объявленную маржу, а не дефолт

**Files:**
- Modify: `src/features/trade/useOrderSizing.ts`, `src/features/trade/TradeForm.tsx`,
  `src/features/trade/leverageSteps.ts`, `src/features/trade/TicketHeader.tsx`,
  `src/features/market/useMarketRows.ts`
- Test: `src/features/trade/__tests__/leverageSteps.test.ts`,
  `src/features/market/__tests__/useMarketRows.test.ts`

**Interfaces:**
- Consumes: `maxLeverageFromBps(bps: bigint): number | null` из `@liq/core`.
- Produces: `OrderSizing.maxLeverage: number | null`, `leverageSteps(max: number | null)`.

`null` значит «рынок потолка не объявил» и по всей цепочке остаётся `null`:
подставить на его место число — снова выдать выдумку за конфигурацию.

- [ ] **Шаг 1:** тест на `leverageSteps(null)` — полная лестница, ничего не дописано.
- [ ] **Шаг 2:** `leverageSteps` принимает `number | null`; `null` → `LADDER` как есть.
- [ ] **Шаг 3:** `useOrderSizing`: `maxLeverage = maxLeverageFromBps(market?.initialMarginBps ?? 0n)`;
      в `validateOrder` уходит `maxLeverage ?? Number.POSITIVE_INFINITY` —
      неизвестный потолок не отказывает в ордере, шлюз и цепочка остаются судьёй.
- [ ] **Шаг 4:** `minSize` уходит: в `validateOrder` — `Qty(0n)` («рынок не объявляет»),
      `baseDecimals` — 4 без вывода из несуществующего поля.
- [ ] **Шаг 5:** `TicketHeader.maxLeverage: number | null`, `TradeForm` передаёт как есть.
- [ ] **Шаг 6:** `useMarketRows.marketRow` считает через `maxLeverageFromBps` вместо копии `10_000n / bps`.
- [ ] **Шаг 7:** `pnpm test` и `pnpm typecheck` зелёные; коммит.

### Задача 3: ордер в полёте виден, отмена выключена

**Files:**
- Modify: `src/features/orders/useOpenOrderRows.ts`, `src/features/orders/OpenOrdersTable.tsx`
- Test: `e2e/tier1/28-in-flight-orders.spec.ts` (new), `e2e/support/world.ts`

**Interfaces:** Produces: `OrderRow.cancellable: boolean`.

Открытый список 0.46.0 сам возвращает `MATCHED`/`SETTLEMENT_SUBMITTED`/`FAILED_RETRYABLE` —
терминалу остаётся не предлагать отмену тому, кого отменить уже нельзя.

- [ ] **Шаг 1:** в мок открытых ордеров добавить строку со статусом `MATCHED`.
- [ ] **Шаг 2:** тест: строка видна, её `cancel-order-*` выключена, у отдыхающей — включена.
- [ ] **Шаг 3:** запустить — падает (кнопка активна у обеих).
- [ ] **Шаг 4:** `useOpenOrderRows`: `cancellable: !isInFlight(order.status)`;
      таблица: `disabled={r.cancelling || !r.cancellable}` и `title` с причиной.
- [ ] **Шаг 5:** тесты зелёные; коммит.

### Задача 4: слово предупреждения приходит из SDK

**Files:** Modify: `src/features/trade/TradeForm.tsx`

- [ ] **Шаг 1:** удалить `WARNING_TEXT` и импорт `OrderWarning`, подставить `describeWarning`.
- [ ] **Шаг 2:** `pnpm test` + `pnpm test:e2e` (спека предупреждения о марже) зелёные; коммит.

### Задача 5: гейт фазы и PR

- [ ] **Шаг 1:** полный гейт (пять команд из Global Constraints).
- [ ] **Шаг 2:** `pnpm test:e2e:live` — о пропусках сказать честно.
- [ ] **Шаг 3:** draft-PR в `liqu-fi/terminal`, база `main`.
