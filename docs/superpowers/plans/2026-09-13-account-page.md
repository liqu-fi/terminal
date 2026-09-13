# Страница Account — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полноэкранная страница Account (`#/account`) с четырьмя вкладками — Overview, Portfolio, Assets, Transactions — на живых данных SDK, с навигацией из шапки терминала.

**Architecture:** URL-хеш — единственное состояние маршрута (`src/lib/hashRoute.ts`, без роутера); `App.tsx` рендерит `AccountPage` вместо `Terminal`, когда хеш начинается с `#/account`. Все числа читаются хуками `@liq/react` (`usePortfolioQuery`, `useSettlementLedgerQuery`, `useCollateralAmountQuery`, `useDepositableBalance`, `useAvailableMarginQuery`) и складываются чистыми функциями `features/account/accountPage.ts`; компоненты ничего не вычисляют. Таблицы истории на вкладке Portfolio — существующий `UserInfoTabs`; депозит/вывод — существующие диалоги.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind v4 (токены в `tokens.css`), `@liq/*@0.50`, `@tanstack/react-query` 5, `@tanstack/react-table` 9, `lightweight-charts` 5 (`BaselineSeries`), radix-ui `Select`, vitest 4 (node), Playwright 1.60 (tier1, hermetic).

**Spec:** `docs/superpowers/specs/2026-09-13-account-page-design.md`

## Global Constraints

- Ветка `feat-cld/account-page`; коммиты — на русском в стиле `git log` (`feat(account): …`), каждый заканчивается строкой `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Пакетный менеджер — **pnpm 11 через proto**; команды: `pnpm typecheck`, `pnpm lint`, `pnpm test` (vitest, окружение node, только `src/**/*.test.ts`), `pnpm test:e2e -- e2e/tier1/30-account-page.spec.ts`.
- Компоненты не тестируются; всякая нетривиальная логика — в чистом `.ts` рядом с тестом в `__tests__/`.
- Никакого `Date.now()` во время рендера (React 19): только в `useState(() => Date.now())` или в обработчиках.
- Прочерк «данных нет» — только `DASH` из `lib/format.ts`. Никаких `toFixed` в компонентах: форматирование — в `lib/format.ts` или `@liq/core`.
- Две системы единиц: портфель шлюза — decimal `number` и unix-**секунды**; леджер/маржа — WAD `bigint` и **миллисекунды**. Стык — только в `accountPage.ts`.
- Плитки без бэкенда (fee tier, security level, staking, статус/balance-after) **не рисуются**.
- Testid — контракт с e2e; имена берутся из задач ниже дословно.
- Каждая задача заканчивается зелёными `pnpm typecheck && pnpm lint && pnpm test` и коммитом.

---

### Task 1: Хеш-маршрут

**Files:**
- Create: `src/lib/hashRoute.ts`
- Test: `src/lib/__tests__/hashRoute.test.ts`

**Interfaces:**
- Produces: `ACCOUNT_TABS`, `type AccountTab`, `type Route`, `parseRoute(hash: string): Route`, `accountHref(tab: AccountTab): string`, `TRADE_HREF`, `useHashRoute(): Route`.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/lib/__tests__/hashRoute.test.ts
import { describe, expect, it } from "vitest";

import { ACCOUNT_TABS, accountHref, parseRoute } from "@/lib/hashRoute";

describe("хеш-маршрут", () => {
  it("пустой хеш и корень — торговый экран", () => {
    expect(parseRoute("")).toEqual({ view: "trade" });
    expect(parseRoute("#")).toEqual({ view: "trade" });
    expect(parseRoute("#/")).toEqual({ view: "trade" });
  });

  it("#/account — обзор; каждая вкладка — по своему сегменту", () => {
    expect(parseRoute("#/account")).toEqual({ view: "account", tab: "overview" });
    expect(parseRoute("#/account/")).toEqual({ view: "account", tab: "overview" });
    for (const tab of ACCOUNT_TABS) {
      expect(parseRoute(`#/account/${tab}`)).toEqual({ view: "account", tab });
    }
  });

  it("неизвестная вкладка и мусор в хеше — торговый экран", () => {
    // Turnkey OAuth кладёт id_token в хеш; парсер обязан его проглотить.
    expect(parseRoute("#id_token=abc.def")).toEqual({ view: "trade" });
    expect(parseRoute("#/account/security")).toEqual({ view: "trade" });
    expect(parseRoute("#/account/assets/extra")).toEqual({ view: "trade" });
  });

  it("accountHref обратен parseRoute", () => {
    for (const tab of ACCOUNT_TABS) {
      expect(parseRoute(accountHref(tab))).toEqual({ view: "account", tab });
    }
    expect(accountHref("overview")).toBe("#/account");
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `pnpm vitest run src/lib/__tests__/hashRoute.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/hashRoute"`.

- [ ] **Step 3: Реализация**

```ts
// src/lib/hashRoute.ts
import { useSyncExternalStore } from "react";

/** Вкладки страницы Account в порядке макета; слаг — сегмент хеша и часть testid. */
export const ACCOUNT_TABS = [
  "overview",
  "portfolio",
  "assets",
  "transactions",
] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];

export type Route =
  | { view: "trade" }
  | { view: "account"; tab: AccountTab };

const TRADE: Route = { view: "trade" };

/** Хеш торгового экрана. */
export const TRADE_HREF = "#/";

/**
 * Разбор хеша. Всё, что не `#/account[/<tab>]`, — торговый экран: страницы
 * не ломаются от чужих хешей (Turnkey OAuth кладёт в хеш `id_token`).
 */
export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] !== "account") return TRADE;
  if (parts.length === 1) return { view: "account", tab: "overview" };
  const tab = ACCOUNT_TABS.find((t) => t === parts[1]);
  return tab !== undefined && parts.length === 2
    ? { view: "account", tab }
    : TRADE;
}

export function accountHref(tab: AccountTab): string {
  return tab === "overview" ? "#/account" : `#/account/${tab}`;
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/**
 * Живой маршрут из `location.hash`. Хеш никогда не переписывается отсюда:
 * навигация — обычные `<a href="#/…">`, «назад» и deep-link работают браузером.
 */
export function useHashRoute(): Route {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => "",
  );
  return parseRoute(hash);
}
```

- [ ] **Step 4: Прогнать тест**

Run: `pnpm vitest run src/lib/__tests__/hashRoute.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 5: Коммит**

```bash
pnpm typecheck && pnpm lint
git add src/lib/hashRoute.ts src/lib/__tests__/hashRoute.test.ts
git commit -m "feat(lib): хеш-маршрут #/account без роутера

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Форматтеры decimal-чисел

**Files:**
- Modify: `src/lib/format.ts` (в конец файла)
- Test: `src/lib/__tests__/format.test.ts` (дописать `describe`)

**Interfaces:**
- Produces: `fmtUsdNum(n: number): string`, `fmtSignedUsdNum(n: number): string`, `fmtPctNum(ratio: number): string` («28.6%»), `fmtSignedPctNum(ratio: number): string` («+2.03%»).

- [ ] **Step 1: Падающий тест** — добавить в конец `src/lib/__tests__/format.test.ts`:

```ts
import { fmtPctNum, fmtSignedPctNum, fmtSignedUsdNum, fmtUsdNum } from "@/lib/format";

describe("decimal-числа портфеля шлюза", () => {
  it("fmtUsdNum: валюта с разрядами и двумя знаками", () => {
    expect(fmtUsdNum(1234.5)).toBe("$1,234.50");
    expect(fmtUsdNum(0)).toBe("$0.00");
    expect(fmtUsdNum(-12)).toBe("-$12.00");
  });

  it("fmtSignedUsdNum: плюс дописан, ноль без знака, минус-ноль — ноль", () => {
    expect(fmtSignedUsdNum(1923.4)).toBe("+$1,923.40");
    expect(fmtSignedUsdNum(-500)).toBe("-$500.00");
    expect(fmtSignedUsdNum(0)).toBe("$0.00");
    expect(fmtSignedUsdNum(-0)).toBe("$0.00");
  });

  it("fmtPctNum и fmtSignedPctNum: доля → проценты", () => {
    expect(fmtPctNum(0.286)).toBe("28.6%");
    expect(fmtPctNum(1)).toBe("100.0%");
    expect(fmtSignedPctNum(0.0203)).toBe("+2.03%");
    expect(fmtSignedPctNum(-0.01)).toBe("-1.00%");
  });
});
```

(Объединить с существующим импортом из `@/lib/format` — один импорт на файл.)

- [ ] **Step 2: Убедиться, что падает**

Run: `pnpm vitest run src/lib/__tests__/format.test.ts`
Expected: FAIL — `fmtUsdNum is not a function` (или ошибка импорта).

- [ ] **Step 3: Реализация** — дописать в `src/lib/format.ts`:

```ts
/**
 * Портфель шлюза (`/accounts/:id/portfolio`) отдаёт decimal-`number`, а не
 * WAD, — единственное место, где терминал печатает не bigint. Формат тот же,
 * что у `formatUsd` SDK: `$1,234.50`.
 */
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtUsdNum(n: number): string {
  return USD.format(n === 0 ? 0 : n);
}

/** «+$1,923.40» / «-$500.00»; ноль (и минус-ноль) — без знака. */
export function fmtSignedUsdNum(n: number): string {
  const v = n === 0 ? 0 : n;
  return (v > 0 ? "+" : "") + USD.format(v);
}

/** Доля → «28.6%» (один знак): уровень использования маржи. */
export function fmtPctNum(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/** Доля со знаком → «+2.03%» (два знака): изменение PnL. */
export function fmtSignedPctNum(ratio: number): string {
  const pct = ratio * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
}
```

- [ ] **Step 4: Прогнать**

Run: `pnpm vitest run src/lib/__tests__/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
pnpm typecheck && pnpm lint
git add src/lib/format.ts src/lib/__tests__/format.test.ts
git commit -m "feat(format): decimal-доллары и проценты для чисел портфеля

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Чистые вычисления страницы

**Files:**
- Create: `src/features/account/accountPage.ts`
- Test: `src/features/account/__tests__/accountPage.test.ts`

**Interfaces:**
- Consumes: типы `PortfolioCollateralEvent`, `PortfolioPeriod`, `PortfolioPoint`, `SettlementLedgerRow` из `@liq/api-client`; `wadToNumber` из `@liq/core`; `UTCTimestamp` из `lightweight-charts`.
- Produces: `PERIODS`, `PERIOD_LABEL`, `periodWindow`, `windowPnl`, `pnlSeries` (+ `type PnlPoint`), `marginUsage`, `type ActivityKind`, `interface ActivityRow`, `ACTIVITY_LABEL`, `activityRows`, `withinWindow`, `filterActivity`, `activityCsv`, `interface TimeWindow`.

- [ ] **Step 1: Падающий тест**

```ts
// src/features/account/__tests__/accountPage.test.ts
import type {
  PortfolioCollateralEvent,
  PortfolioPoint,
  SettlementLedgerRow,
} from "@liq/api-client";
import { describe, expect, it } from "vitest";

import {
  activityCsv,
  activityRows,
  filterActivity,
  marginUsage,
  periodWindow,
  pnlSeries,
  windowPnl,
  withinWindow,
} from "../accountPage";

const WAD = 10n ** 18n;
const DAY = 86_400_000;

function point(over: Partial<PortfolioPoint>): PortfolioPoint {
  return {
    timestamp: 1_700_000_000,
    equityUsd: 1_000,
    realizedPnlUsd: 0,
    unrealizedPnlUsd: 0,
    netDepositsUsd: 1_000,
    ...over,
  };
}

function ledger(over: Partial<SettlementLedgerRow>): SettlementLedgerRow {
  return {
    timestampMs: 1_700_000_000_000,
    txHash: "0x" + "ab".repeat(32),
    logIndex: 1,
    marketId: 100n,
    kind: "settlement",
    sizeDelta: -WAD,
    newSize: 0n,
    fillPrice: 70_000n * WAD,
    pricePnl: 100n * WAD,
    accruedFunding: -2n * WAD,
    interest: 0n,
    totalFees: WAD,
    netBalanceDelta: 99n * WAD,
    ...over,
  } as SettlementLedgerRow;
}

const deposit: PortfolioCollateralEvent = {
  timestamp: 1_700_000_100,
  amountUsd: 2_500,
  type: "deposit",
  collateralId: "2",
};

describe("окно периода", () => {
  it("даёт from/to назад от now, all — без границ", () => {
    const now = 1_800_000_000_000;
    expect(periodWindow("7d", now)).toEqual({
      from: new Date(now - 7 * DAY),
      to: new Date(now),
    });
    expect(periodWindow("all", now)).toEqual({});
  });
});

describe("PnL окна", () => {
  it("депозит посреди окна прибылью не считается", () => {
    const pnl = windowPnl([
      point({ equityUsd: 1_000, netDepositsUsd: 1_000 }),
      point({ equityUsd: 2_050, netDepositsUsd: 2_000 }),
    ]);
    expect(pnl).toEqual({ pnlUsd: 50, pct: 0.05 });
  });

  it("меньше двух точек — неизвестно, а не ноль", () => {
    expect(windowPnl([])).toBeUndefined();
    expect(windowPnl([point({})])).toBeUndefined();
  });

  it("пустой стартовый счёт — процент неизвестен", () => {
    const pnl = windowPnl([
      point({ equityUsd: 0, netDepositsUsd: 0 }),
      point({ equityUsd: 10, netDepositsUsd: 0 }),
    ]);
    expect(pnl).toEqual({ pnlUsd: 10, pct: null });
  });

  it("серия — equity минус депозиты, по возрастанию времени, без дублей", () => {
    const s = pnlSeries([
      point({ timestamp: 20, equityUsd: 1_200, netDepositsUsd: 1_000 }),
      point({ timestamp: 10, equityUsd: 1_000, netDepositsUsd: 1_000 }),
      point({ timestamp: 20, equityUsd: 1_300, netDepositsUsd: 1_000 }),
    ]);
    expect(s).toEqual([
      { time: 10, value: 0 },
      { time: 20, value: 300 },
    ]);
  });
});

describe("использование маржи", () => {
  it("1 − withdrawable/available, в пределах [0, 1]", () => {
    expect(marginUsage(1_000n * WAD, 714n * WAD)).toBeCloseTo(0.286, 3);
    expect(marginUsage(1_000n * WAD, 1_500n * WAD)).toBe(0);
    expect(marginUsage(1_000n * WAD, -5n * WAD)).toBe(1);
  });

  it("нечем измерять — undefined", () => {
    expect(marginUsage(0n, 0n)).toBeUndefined();
    expect(marginUsage(-1n, 0n)).toBeUndefined();
  });
});

describe("лента активности", () => {
  it("сливает секунды событий с миллисекундами леджера, новые сверху", () => {
    const rows = activityRows(
      [deposit],
      [ledger({ timestampMs: 1_700_000_000_000 })],
    );
    expect(rows.map((r) => r.kind)).toEqual(["deposit", "trade"]);
    expect(rows[0].timestampMs).toBe(1_700_000_100_000);
    expect(rows[0].amountUsd).toBe(2_500);
    expect(rows[1].amountUsd).toBe(99);
    expect(rows[1].marketId).toBe(100n);
  });

  it("вывод — со знаком минус независимо от знака на проводе", () => {
    const [row] = activityRows(
      [{ ...deposit, type: "withdrawal", amountUsd: 500 }],
      [],
    );
    expect(row.kind).toBe("withdrawal");
    expect(row.amountUsd).toBe(-500);
  });

  it("ликвидация — своим типом; недоказуемая сумма — null", () => {
    const [row] = activityRows(
      [],
      [ledger({ kind: "liquidation", netBalanceDelta: null })],
    );
    expect(row.kind).toBe("liquidation");
    expect(row.amountUsd).toBeNull();
  });

  it("фильтр по типу и по окну", () => {
    const rows = activityRows([deposit], [ledger({})]);
    expect(filterActivity(rows, "deposit")).toHaveLength(1);
    expect(filterActivity(rows, "all")).toHaveLength(2);
    expect(
      withinWindow(rows, {
        from: new Date(1_700_000_050_000),
        to: new Date(1_700_000_200_000),
      }),
    ).toHaveLength(1);
    expect(withinWindow(rows, {})).toHaveLength(2);
  });

  it("CSV: заголовок, ISO-время, символ рынка, пустые ячейки для «нет»", () => {
    const rows = activityRows(
      [deposit],
      [ledger({ netBalanceDelta: null })],
    );
    const csv = activityCsv(rows, () => "BTC,USD");
    const lines = csv.split("\n");
    expect(lines[0]).toBe("time,type,market,amount_usd,tx");
    expect(lines[1]).toBe("2023-11-14T22:15:00.000Z,Deposit,,2500.00,");
    expect(lines[2]).toBe(
      `2023-11-14T22:13:20.000Z,Trade,"BTC,USD",,0x${"ab".repeat(32)}`,
    );
  });
});
```

- [ ] **Step 2: Убедиться, что падает**

Run: `pnpm vitest run src/features/account/__tests__/accountPage.test.ts`
Expected: FAIL — модуль `../accountPage` не найден.

- [ ] **Step 3: Реализация**

```ts
// src/features/account/accountPage.ts
import type {
  PortfolioCollateralEvent,
  PortfolioPeriod,
  PortfolioPoint,
  SettlementLedgerRow,
} from "@liq/api-client";
import { wadToNumber } from "@liq/core";
import type { UTCTimestamp } from "lightweight-charts";

/**
 * Чистые вычисления страницы Account. Здесь — и только здесь — встречаются две
 * системы единиц: портфель шлюза (decimal `number`, unix-секунды) и
 * леджер/маржа (WAD `bigint`, миллисекунды).
 */

/** Периоды селектора в порядке макета; `1d` живёт только у Today's PnL. */
export const PERIODS: readonly PortfolioPeriod[] = [
  "7d",
  "30d",
  "180d",
  "365d",
  "all",
];

export const PERIOD_LABEL: Record<PortfolioPeriod, string> = {
  "1d": "1D",
  "7d": "7D",
  "30d": "30D",
  "180d": "180D",
  "365d": "1Y",
  all: "All time",
};

const DAY_MS = 86_400_000;
const PERIOD_DAYS: Record<Exclude<PortfolioPeriod, "all">, number> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  "180d": 180,
  "365d": 365,
};

export interface TimeWindow {
  from?: Date;
  to?: Date;
}

/** Окно периода назад от `nowMs`; `all` — без границ (леджер отдаст всё). */
export function periodWindow(period: PortfolioPeriod, nowMs: number): TimeWindow {
  if (period === "all") return {};
  return {
    from: new Date(nowMs - PERIOD_DAYS[period] * DAY_MS),
    to: new Date(nowMs),
  };
}

/** Заработанное счётом: equity без депозитов и выводов (формула реконструкции шлюза). */
function pnlOf(p: PortfolioPoint): number {
  return p.equityUsd - p.netDepositsUsd;
}

/**
 * PnL за окно кривой: разность заработанного между первой и последней точкой.
 * Меньше двух точек — неизвестно (`undefined`), а не `$0.00`: пустой день и
 * день без данных — разные вещи. Процент — от стартового equity; пустой старт
 * — `null`.
 */
export function windowPnl(
  points: readonly PortfolioPoint[],
): { pnlUsd: number; pct: number | null } | undefined {
  if (points.length < 2) return undefined;
  const first = points[0];
  const last = points[points.length - 1];
  const pnlUsd = pnlOf(last) - pnlOf(first);
  return {
    pnlUsd,
    pct: first.equityUsd > 0 ? pnlUsd / first.equityUsd : null,
  };
}

export interface PnlPoint {
  time: UTCTimestamp;
  value: number;
}

/**
 * Кривая накопленного PnL для lightweight-charts: по возрастанию времени и без
 * повторов (библиотека требует строго возрастающий ряд; при дубле берётся
 * последняя точка).
 */
export function pnlSeries(points: readonly PortfolioPoint[]): PnlPoint[] {
  const byTime = new Map<number, number>();
  for (const p of [...points].sort((a, b) => a.timestamp - b.timestamp)) {
    byTime.set(p.timestamp, pnlOf(p));
  }
  return [...byTime].map(([time, value]) => ({
    time: time as UTCTimestamp,
    value,
  }));
}

/**
 * Доля маржи, занятой позициями: `1 − withdrawable/available`, в `[0, 1]`.
 * Неположительный `available` — измерять нечем, `undefined`.
 */
export function marginUsage(
  available: bigint,
  withdrawable: bigint,
): number | undefined {
  if (available <= 0n) return undefined;
  const used = 1 - wadToNumber(withdrawable) / wadToNumber(available);
  return Math.min(1, Math.max(0, used));
}

export type ActivityKind = "deposit" | "withdrawal" | "trade" | "liquidation";

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  trade: "Trade",
  liquidation: "Liquidation",
};

export interface ActivityRow {
  id: string;
  kind: ActivityKind;
  timestampMs: number;
  /** Знаковый USD; `null` — леджер не смог доказать сумму. */
  amountUsd: number | null;
  marketId?: bigint;
  txHash?: string;
}

/**
 * Одна лента из событий депозитов/выводов и строк леджера, новые сверху.
 * Событие: знак — от типа, не от провода. Строка леджера: одна запись на
 * расчёт, сумма — `netBalanceDelta` (фандинг и комиссии уже внутри; отдельная
 * строка фандинга удвоила бы сумму).
 */
export function activityRows(
  events: readonly PortfolioCollateralEvent[],
  ledger: readonly SettlementLedgerRow[],
): ActivityRow[] {
  const fromEvents = events.map<ActivityRow>((e) => ({
    id: `${e.type}-${e.timestamp}-${e.collateralId}-${e.amountUsd}`,
    kind: e.type,
    timestampMs: e.timestamp * 1000,
    amountUsd:
      e.type === "withdrawal" ? -Math.abs(e.amountUsd) : Math.abs(e.amountUsd),
  }));
  const fromLedger = ledger.map<ActivityRow>((r) => ({
    id: `${r.txHash}-${r.logIndex}`,
    kind: r.kind === "liquidation" ? "liquidation" : "trade",
    timestampMs: r.timestampMs,
    amountUsd:
      r.netBalanceDelta === null ? null : wadToNumber(r.netBalanceDelta),
    marketId: r.marketId,
    txHash: r.txHash,
  }));
  return [...fromEvents, ...fromLedger].sort(
    (a, b) => b.timestampMs - a.timestampMs,
  );
}

/** Клиентский фильтр по окну: шлюз не обещает окна для событий депозитов. */
export function withinWindow(
  rows: readonly ActivityRow[],
  range: TimeWindow,
): ActivityRow[] {
  const from = range.from?.getTime() ?? -Infinity;
  const to = range.to?.getTime() ?? Infinity;
  return rows.filter((r) => r.timestampMs >= from && r.timestampMs <= to);
}

export function filterActivity(
  rows: readonly ActivityRow[],
  kind: ActivityKind | "all",
): ActivityRow[] {
  return kind === "all" ? [...rows] : rows.filter((r) => r.kind === kind);
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV для кнопки Export: ISO-время, тип, символ рынка, сумма, tx; «нет» — пустая ячейка. */
export function activityCsv(
  rows: readonly ActivityRow[],
  symbolOf: (marketId: bigint) => string,
): string {
  const lines = rows.map((r) =>
    [
      new Date(r.timestampMs).toISOString(),
      ACTIVITY_LABEL[r.kind],
      r.marketId === undefined ? "" : symbolOf(r.marketId),
      r.amountUsd === null ? "" : r.amountUsd.toFixed(2),
      r.txHash ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  return ["time,type,market,amount_usd,tx", ...lines].join("\n");
}
```

- [ ] **Step 4: Прогнать**

Run: `pnpm vitest run src/features/account/__tests__/accountPage.test.ts`
Expected: PASS (все `describe`). Если падает CSV-тест по времени — проверить, что ISO-строки в ожидании соответствуют `1_700_000_100_000` и `1_700_000_000_000` (правится тест, не код).

- [ ] **Step 5: Коммит**

```bash
pnpm typecheck && pnpm lint
git add src/features/account/accountPage.ts src/features/account/__tests__/accountPage.test.ts
git commit -m "feat(account): чистые вычисления страницы — окно PnL, лента активности, CSV

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Расширить свод счёта; остатки коллатералов одним хуком

**Files:**
- Modify: `src/features/account/useAccountSummary.ts`
- Create: `src/features/account/useCollateralBalances.ts`
- Test: `src/features/account/__tests__/accountSummary.test.ts` (дописать)

**Interfaces:**
- Consumes: `marginUsage` из `./accountPage` (Task 3).
- Produces: `summarize()` принимает необязательные `withdrawable?: bigint`, `free?: bigint`; `AccountSummary` получает `free: bigint | undefined`, `marginUsage: number | undefined`. `useCollateralBalances(): { balances: CollateralBalance[]; totalWad: bigint | undefined }`, `interface CollateralBalance { symbol: string; marketId: bigint; amount: bigint | undefined }`.

- [ ] **Step 1: Падающий тест** — дописать в `describe("свод счёта")`:

```ts
  it("использование маржи — доля available, недоступная к выводу", () => {
    const s = summarize({
      available: 1000n * WAD,
      withdrawable: 714n * WAD,
      locked: 0n,
      debt: 0n,
      positions: [],
    });
    expect(s.marginUsage).toBeCloseTo(0.286, 3);
  });

  it("free шлюза проходит как есть — и отрицательным", () => {
    const s = summarize({
      available: 1000n * WAD,
      locked: 1_040n * WAD,
      free: -40n * WAD,
      debt: 0n,
      positions: [],
    });
    expect(s.free).toBe(-40n * WAD);
  });

  it("без withdrawable и без залога использование маржи неизвестно", () => {
    expect(
      summarize({ available: 1000n * WAD, locked: 0n, debt: 0n, positions: [] })
        .marginUsage,
    ).toBeUndefined();
    expect(
      summarize({
        available: undefined,
        withdrawable: 0n,
        locked: 0n,
        debt: 0n,
        positions: [],
      }).marginUsage,
    ).toBeUndefined();
  });
```

- [ ] **Step 2: Убедиться, что падает**

Run: `pnpm vitest run src/features/account/__tests__/accountSummary.test.ts`
Expected: FAIL — `marginUsage`/`free` undefined там, где ожидается число (и ошибка типов на лишних полях в `pnpm typecheck`, если запускать).

- [ ] **Step 3: Реализация** — правки в `useAccountSummary.ts`:

```ts
import { marginUsage } from "./accountPage";

interface SummaryInput {
  available: bigint | undefined;
  /** `getWithdrawableMargin` — то, что можно вывести, не задев начальную маржу. */
  withdrawable?: bigint;
  locked: bigint;
  /** `free` шлюза = `available − locked`; может быть отрицательным. */
  free?: bigint;
  debt: bigint;
  positions: SummaryPosition[];
}

interface AccountSummary {
  unrealizedPnl: bigint;
  accountValue: bigint | undefined;
  equity: bigint | undefined;
  borrowed: bigint;
  exposure: bigint;
  leverage: bigint | undefined;
  /** Доступно для новых ордеров по мнению шлюза. */
  free: bigint | undefined;
  /** Доля маржи под позициями, `[0, 1]`. */
  marginUsage: number | undefined;
}
```

В `summarize()` перед `return`:

```ts
  const usage =
    accountValue === undefined || input.withdrawable === undefined
      ? undefined
      : marginUsage(accountValue, input.withdrawable);
```

и в возвращаемом объекте: `free: input.free, marginUsage: usage`.

В хуке `useAccountSummary()` передать в `summarize`:

```ts
      available: margins?.available,
      withdrawable: margins?.withdrawable,
      locked: gatewayMargin?.locked ?? 0n,
      free: gatewayMargin?.free,
```

Обновить TSDoc «Шесть чисел панели из четырёх чтений» → «Восемь чисел…».

- [ ] **Step 4: Прогнать**

Run: `pnpm vitest run src/features/account/__tests__/accountSummary.test.ts`
Expected: PASS (8 тестов).

- [ ] **Step 5: Хук остатков коллатералов**

```ts
// src/features/account/useCollateralBalances.ts
import { getChainConfig, getCollaterals } from "@liq/core";
import {
  useAccountId,
  useLiqOnchain,
  useLiqQueryKeys,
  useNetworkId,
  useWallet,
} from "@liq/react";
import { useQueries } from "@tanstack/react-query";

export interface CollateralBalance {
  symbol: string;
  marketId: bigint;
  /** WAD; `undefined` — ещё не прочитано. */
  amount: bigint | undefined;
}

/**
 * Остатки всех коллатералов контура для итога «Total collateral» и карточки
 * Assets на Overview.
 *
 * @remarks Ключи и `queryFn` — те же, что у `useCollateralAmountQuery` SDK
 * (`keys.account.collateral(wallet, id)` + `onchain.collateral.collateralAmount`):
 * одна запись кеша на токен, строки таблицы Assets и итог не расходятся.
 * Список токенов статичен для сети, поэтому число запросов между рендерами не
 * меняется.
 */
export function useCollateralBalances(): {
  balances: CollateralBalance[];
  totalWad: bigint | undefined;
} {
  const networkId = useNetworkId();
  const onchain = useLiqOnchain();
  const keys = useLiqQueryKeys();
  const wallet = useWallet();
  const accountId = useAccountId();
  const entries = Object.entries(getCollaterals(getChainConfig(networkId)));

  const results = useQueries({
    queries: entries.map(([, c]) => ({
      queryKey: keys.account.collateral(wallet ?? "", String(c.marketId)),
      queryFn: () =>
        onchain.collateral.collateralAmount(accountId!, BigInt(c.marketId)),
      enabled: accountId !== undefined && wallet !== null,
      staleTime: 5_000,
    })),
  });

  const balances = entries.map<CollateralBalance>(([symbol, c], i) => ({
    symbol,
    marketId: BigInt(c.marketId),
    amount: results[i].data,
  }));
  const totalWad = balances.every((b) => b.amount !== undefined)
    ? balances.reduce((sum, b) => sum + b.amount!, 0n)
    : undefined;
  return { balances, totalWad };
}
```

Если `pnpm typecheck` ругается на арность `keys.account.collateral` — открыть `node_modules/@liq/react/dist/index.js`, функция `useCollateralAmountQuery`: вызов там `keys.account.collateral(wallet ?? "", collateralId.toString())`; повторить его сигнатуру дословно.

- [ ] **Step 6: Коммит**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/features/account/useAccountSummary.ts src/features/account/useCollateralBalances.ts src/features/account/__tests__/accountSummary.test.ts
git commit -m "feat(account): free и использование маржи в своде; остатки коллатералов одним хуком

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Оболочка страницы, навигация, вкладка Overview

**Files:**
- Create: `src/lib/cssVar.ts`
- Modify: `src/features/chart/CandleChart.tsx` (убрать локальный `cssVar`, импортировать из `@/lib/cssVar`)
- Create: `src/features/account/PnlChart.tsx`
- Create: `src/features/account/AccountCards.tsx`
- Create: `src/features/account/AccountPage.tsx`
- Create: `src/features/account/OverviewTab.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useHashRoute`, `accountHref`, `ACCOUNT_TABS`, `TRADE_HREF` (Task 1); `fmtUsdNum`, `fmtSignedUsdNum`, `fmtSignedPctNum`, `fmtPctNum` (Task 2); `windowPnl`, `pnlSeries`, `activityRows`, `ACTIVITY_LABEL`, `type PnlPoint`, `type ActivityRow` (Task 3); `useAccountSummary` с `free`/`marginUsage`, `useCollateralBalances` (Task 4).
- Produces: `Panel`, `Stat`, `PeriodSelect`, `Unavailable` из `AccountCards.tsx`; `PnlChart`; `AccountPage({ tab })`; `OverviewTab()`.

- [ ] **Step 1: Вынести `cssVar`**

```ts
// src/lib/cssVar.ts
/**
 * Значение CSS-токена (`--long`, `--border`…) строкой — для библиотек, которым
 * нужен готовый цвет. Палитра объявлена один раз в `styles/tokens.css`;
 * захардкоженный hex молча разъехался бы с ней при перекраске.
 */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
```

В `CandleChart.tsx` удалить локальную `function cssVar` вместе с её TSDoc-комментарием и добавить `import { cssVar } from "@/lib/cssVar";`.

- [ ] **Step 2: График PnL**

```tsx
// src/features/account/PnlChart.tsx
import {
  BaselineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

import { cssVar } from "@/lib/cssVar";

import type { PnlPoint } from "./accountPage";

/**
 * Кривая накопленного PnL: выше нуля — цвет long, ниже — short. Родитель
 * задаёт высоту (`autoSize` меряет контейнер). Заливки прозрачные: линии
 * достаточно, а альфа-суффикс к hex-токену сломал бы форк с не-hex палитрой.
 */
export function PnlChart({
  series,
  testid,
}: {
  series: PnlPoint[];
  testid: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Baseline"> | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const muted = cssVar("--muted");
    const border = cssVar("--border");
    const long = cssVar("--long");
    const short = cssVar("--short");
    const chart = createChart(node, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: muted },
      grid: {
        vertLines: { color: border },
        horzLines: { color: border },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderVisible: false },
    });
    const baseline = chart.addSeries(BaselineSeries, {
      baseValue: { type: "price", price: 0 },
      topLineColor: long,
      topFillColor1: "transparent",
      topFillColor2: "transparent",
      bottomLineColor: short,
      bottomFillColor1: "transparent",
      bottomFillColor2: "transparent",
      lineWidth: 2,
      priceLineVisible: false,
    });
    chartRef.current = chart;
    seriesRef.current = baseline;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const baseline = seriesRef.current;
    const chart = chartRef.current;
    if (!baseline || !chart) return;
    baseline.setData(series);
    chart.timeScale().fitContent();
  }, [series]);

  return (
    <div className="relative h-full w-full" data-testid={testid}>
      <div ref={containerRef} className="h-full w-full" />
      {series.length === 0 && (
        <p
          className="absolute inset-0 flex items-center justify-center text-xs text-muted"
          data-testid={`${testid}-empty`}
        >
          No data for this period
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Общие карточки**

```tsx
// src/features/account/AccountCards.tsx
import type { PortfolioPeriod } from "@liq/api-client";
import type { ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { PERIOD_LABEL, PERIODS } from "./accountPage";

/**
 * Карточка страницы Account. Со своей рамкой и скруглением — в отличие от
 * `Card` терминала: там панели стоят вплотную под одной общей рамкой, здесь
 * карточки разнесены сеткой и рамка у каждой.
 */
export function Panel({
  children,
  className = "",
  testid,
}: {
  children: ReactNode;
  className?: string;
  testid?: string;
}) {
  return (
    <section
      className={`rounded-[var(--radius-card)] border border-border bg-surface p-4 ${className}`}
      data-testid={testid}
    >
      {children}
    </section>
  );
}

/** Плитка «подпись / значение», справа — необязательная ссылка-стрелка. */
export function Stat({
  label,
  value,
  tone = "text-text",
  link,
  testid,
}: {
  label: string;
  value: string;
  tone?: string;
  link?: { href: string; text: string };
  testid: string;
}) {
  return (
    <Panel className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>{label}</span>
        {link && (
          <a href={link.href} className="shrink-0 text-accent hover:underline">
            {link.text} →
          </a>
        )}
      </div>
      <span
        className={`text-xl font-semibold tabular-nums ${tone}`}
        data-testid={testid}
      >
        {value}
      </span>
    </Panel>
  );
}

/** Селектор периода портфеля; пункты — `${testid}-${period}`. */
export function PeriodSelect({
  value,
  onChange,
  testid,
}: {
  value: PortfolioPeriod;
  onChange: (period: PortfolioPeriod) => void;
  testid: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as PortfolioPeriod)}
    >
      <SelectTrigger size="sm" className="h-7 text-xs" data-testid={testid}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIODS.map((p) => (
          <SelectItem key={p} value={p} data-testid={`${testid}-${p}`}>
            {PERIOD_LABEL[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** `available: false` портфеля: сабграф молчит — кривой нет, а не ошибка. */
export function Unavailable() {
  return (
    <p
      className="flex h-full items-center justify-center text-center text-xs text-muted"
      data-testid="portfolio-unavailable"
    >
      Portfolio history is unavailable on this gateway
    </p>
  );
}
```

- [ ] **Step 4: Оболочка страницы**

```tsx
// src/features/account/AccountPage.tsx
import { useSessionStage } from "@liq/react";

import { ACCOUNT_TABS, accountHref, type AccountTab } from "@/lib/hashRoute";

import { SessionCta } from "../auth/SessionCta";
import { Panel } from "./AccountCards";
import { OverviewTab } from "./OverviewTab";

const TAB_LABEL: Record<AccountTab, string> = {
  overview: "Overview",
  portfolio: "Portfolio",
  assets: "Assets",
  transactions: "Transactions",
};

/**
 * Полноэкранная страница счёта. Вкладки — настоящие ссылки на хеш: колесо,
 * средняя кнопка и «назад» работают браузером. На стадиях `no-account` /
 * `needs-signin` вместо вкладок стоит тот же `SessionCta`, что и в подвале
 * тикета: иначе с `#/account` было бы некуда войти.
 */
export function AccountPage({ tab }: { tab: AccountTab }) {
  const stage = useSessionStage();
  const onboarding = stage === "no-account" || stage === "needs-signin";

  return (
    <div
      className="scroll-thin min-h-0 flex-1 overflow-y-auto"
      data-testid="account-page"
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 p-4">
        <h1 className="text-lg font-semibold">Account</h1>
        <nav
          className="inline-flex w-fit items-center gap-1 rounded-lg bg-surface-2 p-[3px] text-sm"
          aria-label="Account sections"
        >
          {ACCOUNT_TABS.map((t) => (
            <a
              key={t}
              href={accountHref(t)}
              aria-current={t === tab ? "page" : undefined}
              data-testid={`account-tab-${t}`}
              className={`rounded-md px-3 py-1 font-medium ${
                t === tab ? "bg-surface text-text" : "text-muted hover:text-text"
              }`}
            >
              {TAB_LABEL[t]}
            </a>
          ))}
        </nav>
        {onboarding ? (
          <Panel className="flex max-w-sm flex-col gap-2" testid="account-session-cta">
            <p className="text-sm text-muted">
              {stage === "no-account"
                ? "Create a trading account to see balances and history."
                : "Sign in to the gateway to see your account."}
            </p>
            <SessionCta stage={stage} />
          </Panel>
        ) : (
          <TabBody tab={tab} />
        )}
      </div>
    </div>
  );
}

function TabBody({ tab }: { tab: AccountTab }) {
  switch (tab) {
    case "overview":
      return <OverviewTab />;
    default:
      // Portfolio, Assets, Transactions добавляются следующими задачами плана.
      return null;
  }
}
```

- [ ] **Step 5: Вкладка Overview**

```tsx
// src/features/account/OverviewTab.tsx
import { formatUsd } from "@liq/core";
import {
  useAccountId,
  usePortfolioQuery,
  useSettlementLedgerQuery,
} from "@liq/react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { accountHref } from "@/lib/hashRoute";

import {
  DASH,
  fmtLeverage,
  fmtPctNum,
  fmtSignedPctNum,
  fmtSignedUsd,
  fmtSignedUsdNum,
  fmtTime,
  fmtUsdNum,
} from "../../lib/format";
import { marketSymbol, useSelectedMarket } from "../market/useSelectedMarket";
import { Panel, Stat, Unavailable } from "./AccountCards";
import {
  ACTIVITY_LABEL,
  activityRows,
  pnlSeries,
  windowPnl,
  type ActivityRow,
} from "./accountPage";
import { DepositDialog } from "./DepositDialog";
import { PnlChart } from "./PnlChart";
import { useAccountSummary } from "./useAccountSummary";
import { useCollateralBalances } from "./useCollateralBalances";
import { WithdrawDialog } from "./WithdrawDialog";

/** Сколько строк ленты показывает Overview; остальное — во вкладке Transactions. */
const RECENT = 5;

export function OverviewTab() {
  const accountId = useAccountId();
  const { summary } = useAccountSummary();
  const { markets } = useSelectedMarket();
  // Два окна портфеля: `1d` — Today's PnL, `30d` — события депозитов/выводов
  // для ленты. Lifetime-сводка (объём) одна и та же в обоих ответах.
  const { data: today } = usePortfolioQuery(accountId, "1d");
  const { data: month } = usePortfolioQuery(accountId, "30d");
  const { data: ledger } = useSettlementLedgerQuery(accountId, {
    limit: RECENT,
  });
  const { balances, totalWad } = useCollateralBalances();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const pnl = today?.available ? windowPnl(today.points) : undefined;
  const series = useMemo(
    () => (today?.available ? pnlSeries(today.points) : []),
    [today],
  );
  // «≈»: сервер применил приближение или не дочитал историю — числа не
  // подменяем, но и за точные не выдаём.
  const approx =
    today?.summary.estimated || today?.coverage?.eventsComplete === false
      ? "≈"
      : "";
  const activity = useMemo(
    () =>
      activityRows(
        month?.available ? month.collateralEvents : [],
        ledger?.rows ?? [],
      ).slice(0, RECENT),
    [month, ledger],
  );
  const heldAssets = balances.filter((b) => (b.amount ?? 0n) > 0n).length;

  return (
    <>
      <div className="grid gap-3 md:grid-cols-4">
        <Stat
          label="Trading volume · all time"
          testid="account-stat-volume"
          value={today?.available ? fmtUsdNum(today.summary.volumeUsd) : DASH}
        />
        <Stat
          label="Account value"
          testid="account-stat-value"
          value={
            summary.accountValue === undefined
              ? DASH
              : formatUsd(summary.accountValue)
          }
          link={{ href: accountHref("portfolio"), text: "View portfolio" }}
        />
        <Stat
          label="Unrealized PnL"
          testid="account-stat-upnl"
          tone={summary.unrealizedPnl < 0n ? "text-short" : "text-long"}
          value={fmtSignedUsd(summary.unrealizedPnl)}
        />
        <Stat
          label="Account leverage"
          testid="account-stat-leverage"
          value={
            summary.leverage === undefined ? DASH : fmtLeverage(summary.leverage)
          }
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Panel className="flex flex-col gap-3 md:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs text-muted">Today's PnL</div>
              <div
                className={`text-xl font-semibold tabular-nums ${
                  pnl && pnl.pnlUsd < 0 ? "text-short" : "text-long"
                }`}
                data-testid="today-pnl"
              >
                {pnl
                  ? `${approx}${fmtSignedUsdNum(pnl.pnlUsd)}${
                      pnl.pct === null ? "" : ` (${fmtSignedPctNum(pnl.pct)})`
                    }`
                  : DASH}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setDepositOpen(true)}
                data-testid="account-deposit-button"
              >
                Deposit
              </Button>
              <Button
                variant="ghost"
                onClick={() => setWithdrawOpen(true)}
                data-testid="account-withdraw-button"
              >
                Withdraw
              </Button>
            </div>
          </div>
          <div className="h-56">
            {today?.available === false ? (
              <Unavailable />
            ) : (
              <PnlChart series={series} testid="today-pnl-chart" />
            )}
          </div>
        </Panel>

        <Panel className="flex flex-col gap-1" testid="recent-activity">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold">Recent activity</span>
            <a
              href={accountHref("transactions")}
              className="text-xs text-accent hover:underline"
            >
              View all →
            </a>
          </div>
          {activity.length === 0 ? (
            <p
              className="py-6 text-center text-xs text-muted"
              data-testid="recent-activity-empty"
            >
              No recent activity yet
            </p>
          ) : (
            activity.map((row) => (
              <ActivityLine
                key={row.id}
                row={row}
                symbol={
                  row.marketId === undefined
                    ? undefined
                    : marketSymbol(markets, row.marketId)
                }
              />
            ))
          )}
        </Panel>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Stat
          label="Trading"
          testid="account-card-trading"
          value={summary.equity === undefined ? DASH : formatUsd(summary.equity)}
          link={{ href: accountHref("portfolio"), text: "View portfolio" }}
        />
        <Stat
          label="Assets"
          testid="account-card-assets"
          value={totalWad === undefined ? DASH : formatUsd(totalWad)}
          link={{ href: accountHref("assets"), text: "View assets" }}
        />
      </div>
      <div className="-mt-2 grid gap-3 text-xs text-muted md:grid-cols-2">
        <span data-testid="account-card-trading-sub">
          Margin usage{" "}
          {summary.marginUsage === undefined
            ? DASH
            : fmtPctNum(summary.marginUsage)}
        </span>
        <span data-testid="account-card-assets-sub">
          {heldAssets} {heldAssets === 1 ? "asset" : "assets"}
        </span>
      </div>

      <DepositDialog open={depositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawDialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
      />
    </>
  );
}

function ActivityLine({ row, symbol }: { row: ActivityRow; symbol?: string }) {
  const tone =
    row.amountUsd === null
      ? "text-muted"
      : row.amountUsd < 0
        ? "text-short"
        : "text-long";
  return (
    <div
      className="flex items-center justify-between gap-2 border-b border-border py-1.5 text-xs last:border-b-0"
      data-testid="recent-activity-row"
    >
      <div className="flex flex-col">
        <span>
          {ACTIVITY_LABEL[row.kind]}
          {symbol ? ` · ${symbol}` : ""}
        </span>
        <span className="text-muted">{fmtTime(row.timestampMs)}</span>
      </div>
      <span className={`tabular-nums ${tone}`}>
        {row.amountUsd === null ? DASH : fmtSignedUsdNum(row.amountUsd)}
      </span>
    </div>
  );
}
```

Подстрочники карточек Trading/Assets вынесены отдельной строкой сетки, потому что `Stat` их не знает; если верстальщику удобнее — добавить в `Stat` необязательный проп `sub?: ReactNode` и рисовать его под значением (тогда второй `grid` и оба `*-sub` переезжают внутрь `Stat`; testid сохранить).

- [ ] **Step 6: Навигация в `App.tsx`**

```tsx
import { AccountPage } from "./features/account/AccountPage";
import { SessionGate } from "./features/auth/SessionGate";
import { ConnectButton } from "./features/wallet/ConnectButton";
import { MarketProvider } from "./features/market/MarketContext";
import { Terminal } from "./features/terminal/Terminal";
import { TRADE_HREF, useHashRoute } from "./lib/hashRoute";

export default function App() {
  const route = useHashRoute();
  const onAccount = route.view === "account";
  return (
    <MarketProvider>
      <div className="flex h-full min-h-[600px] flex-col" data-testid="app-root">
        <header className="flex shrink-0 items-center gap-4 border-b border-border bg-surface-2 px-4 py-1.5">
          <span className="font-bold tracking-wide" data-testid="app-brand">
            ◢ terminal
          </span>
          {/* Два вида — две ссылки на хеш; роутера в терминале нет (см. hashRoute). */}
          <nav className="flex items-center gap-3 text-sm" aria-label="Primary">
            <a
              href={TRADE_HREF}
              aria-current={onAccount ? undefined : "page"}
              data-testid="nav-trade"
              className={onAccount ? "text-muted hover:text-text" : "font-semibold text-text"}
            >
              Trade
            </a>
            <a
              href="#/account"
              aria-current={onAccount ? "page" : undefined}
              data-testid="nav-account"
              className={onAccount ? "font-semibold text-text" : "text-muted hover:text-text"}
            >
              Account
            </a>
          </nav>
          <div className="flex-1" />
          <ConnectButton />
        </header>
        <main className="flex min-h-0 flex-1 flex-col p-2">
          <SessionGate>
            {/* Терминал размонтируется на странице счёта: кеш react-query
                переживает, SSE переподписывается при возврате. */}
            {route.view === "account" ? (
              <AccountPage tab={route.tab} />
            ) : (
              <Terminal />
            )}
          </SessionGate>
        </main>
      </div>
    </MarketProvider>
  );
}
```

Сохранить существующий TSDoc над `App` (про `h-full` / `min-h-0`).

- [ ] **Step 7: Проверить руками**

Run: `pnpm typecheck && pnpm lint && pnpm test`, затем `pnpm dev` и открыть `http://localhost:5173/#/account` со staging-конфигом из `.env`: видны заголовок, четыре вкладки, четыре плитки, Today's PnL с графиком или «—», лента, две карточки; клик «Trade» возвращает терминал; на 390px — одна колонка. Без `.env` достаточно `pnpm build`.

- [ ] **Step 8: Коммит**

```bash
git add src/lib/cssVar.ts src/features/chart/CandleChart.tsx src/features/account/PnlChart.tsx src/features/account/AccountCards.tsx src/features/account/AccountPage.tsx src/features/account/OverviewTab.tsx src/App.tsx
git commit -m "feat(account): страница Account — навигация из шапки и вкладка Overview на живых данных

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Вкладка Portfolio

**Files:**
- Create: `src/features/account/PortfolioTab.tsx`
- Modify: `src/features/account/AccountPage.tsx` (`case "portfolio"`)

**Interfaces:**
- Consumes: `Panel`, `Stat`, `PeriodSelect`, `Unavailable` (Task 5); `PnlChart`; `periodWindow`, `pnlSeries` (Task 3); `useAccountSummary` (`free`, `marginUsage`, `unrealizedPnl`, `accountValue`); `UserInfoTabs` из `../userinfo/UserInfoTabs`.
- Produces: `PortfolioTab()`.

- [ ] **Step 1: Компонент**

```tsx
// src/features/account/PortfolioTab.tsx
import type { PortfolioPeriod } from "@liq/api-client";
import { formatUsd, wadToNumber } from "@liq/core";
import {
  useAccountId,
  usePortfolioQuery,
  useSettlementLedgerQuery,
} from "@liq/react";
import { useMemo, useState } from "react";

import {
  DASH,
  fmtPctNum,
  fmtSignedPctNum,
  fmtSignedUsd,
  fmtUsdNum,
} from "../../lib/format";
import { UserInfoTabs } from "../userinfo/UserInfoTabs";
import { Panel, PeriodSelect, Stat, Unavailable } from "./AccountCards";
import { periodWindow, pnlSeries } from "./accountPage";
import { PnlChart } from "./PnlChart";
import { useAccountSummary } from "./useAccountSummary";

/**
 * Первая страница леджера — потолок шлюза. Дальше нужен `nextCursor`.
 * ponytail: первые 200 расчётов за период; пагинация — когда у счёта их станет больше.
 */
const LEDGER_PAGE = 200;

export function PortfolioTab() {
  const accountId = useAccountId();
  const { summary } = useAccountSummary();
  const [period, setPeriod] = useState<PortfolioPeriod>("30d");
  // `now` — в состоянии, не в рендере (React 19): окно пересчитывается на
  // смене периода, а не на каждом тике.
  const [now, setNow] = useState(() => Date.now());
  const range = useMemo(() => periodWindow(period, now), [period, now]);

  const { data: portfolio, isLoading: portfolioLoading } = usePortfolioQuery(
    accountId,
    period,
  );
  const { data: ledger } = useSettlementLedgerQuery(accountId, {
    ...range,
    limit: LEDGER_PAGE,
  });

  const series = useMemo(
    () => (portfolio?.available ? pnlSeries(portfolio.points) : []),
    [portfolio],
  );
  const totals = ledger?.totals ?? null;
  const approx = totals !== null && !totals.complete ? "≈" : "";
  const upnlPct =
    summary.accountValue !== undefined && summary.accountValue > 0n
      ? wadToNumber(summary.unrealizedPnl) / wadToNumber(summary.accountValue)
      : null;

  function changePeriod(next: PortfolioPeriod) {
    setPeriod(next);
    setNow(Date.now());
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
        <Panel className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Overview</span>
            <PeriodSelect
              value={period}
              onChange={changePeriod}
              testid="portfolio-period"
            />
          </div>
          <Metric
            label="Unrealized PnL"
            testid="portfolio-upnl"
            tone={summary.unrealizedPnl < 0n ? "text-short" : "text-long"}
            value={fmtSignedUsd(summary.unrealizedPnl)}
            sub={upnlPct === null ? undefined : fmtSignedPctNum(upnlPct)}
          />
          <Metric
            label="Portfolio value"
            testid="portfolio-value"
            value={
              summary.accountValue === undefined
                ? DASH
                : formatUsd(summary.accountValue)
            }
          />
          <Metric
            label="Trading volume · all time"
            testid="portfolio-volume"
            value={
              portfolio?.available ? fmtUsdNum(portfolio.summary.volumeUsd) : DASH
            }
          />
        </Panel>

        <Panel className="flex h-72 flex-col md:h-auto">
          {portfolio?.available === false ? (
            <Unavailable />
          ) : (
            <PnlChart
              series={portfolioLoading ? [] : series}
              testid="portfolio-pnl-chart"
            />
          )}
        </Panel>

        <Panel className="flex flex-col gap-2" testid="pnl-breakdown">
          <span className="text-sm font-semibold">PnL breakdown</span>
          <span className="text-[11px] text-muted">
            Selected period{approx ? " · first 200 settlements" : ""}
          </span>
          <BreakdownRow label="Realized PnL" value={totals?.pricePnl ?? null} prefix={approx} />
          <BreakdownRow label="Funding" value={totals?.accruedFunding ?? null} prefix={approx} />
          <BreakdownRow
            label="Trading fees"
            value={totals === null || totals.totalFees === null ? null : -totals.totalFees}
            prefix={approx}
          />
          <BreakdownRow label="Net" value={totals?.netBalanceDelta ?? null} prefix={approx} strong />
          <div className="mt-1 border-t border-border pt-1">
            <BreakdownRow label="Unrealized (now)" value={summary.unrealizedPnl} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Stat
          label="Available to trade"
          testid="portfolio-free"
          tone={summary.free !== undefined && summary.free < 0n ? "text-short" : "text-text"}
          value={summary.free === undefined ? DASH : formatUsd(summary.free)}
        />
        <Stat
          label="Margin usage"
          testid="portfolio-margin-usage"
          value={
            summary.marginUsage === undefined ? DASH : fmtPctNum(summary.marginUsage)
          }
        />
      </div>

      {/* Те же семь таблиц, что в терминале. Высота явная: таблицы меряют себя
          от flex-родителя и в потоке страницы схлопнулись бы. */}
      <div
        className="flex h-[420px] flex-col overflow-hidden rounded-[var(--radius-card)] border border-border"
        data-testid="portfolio-tables"
      >
        <UserInfoTabs fullscreenToggle={false} />
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  sub,
  tone = "text-text",
  testid,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
  testid: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-lg font-semibold tabular-nums ${tone}`} data-testid={testid}>
        {value}
      </span>
      {sub && <span className={`text-xs ${tone}`}>{sub}</span>}
    </div>
  );
}

/** Строка breakdown: WAD со знаком либо прочерк — `null` в леджере значит «недоказуемо». */
function BreakdownRow({
  label,
  value,
  prefix = "",
  strong = false,
}: {
  label: string;
  value: bigint | null;
  prefix?: string;
  strong?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between text-xs ${strong ? "font-semibold" : ""}`}>
      <span className="text-muted">{label}</span>
      <span
        className={`tabular-nums ${
          value === null ? "text-muted" : value < 0n ? "text-short" : "text-long"
        }`}
      >
        {value === null ? DASH : `${prefix}${fmtSignedUsd(value)}`}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Подключить в `AccountPage.tsx`**

```tsx
import { PortfolioTab } from "./PortfolioTab";
// …в TabBody:
    case "portfolio":
      return <PortfolioTab />;
```

- [ ] **Step 3: Проверить**

Run: `pnpm typecheck && pnpm lint && pnpm test`; `pnpm dev` → `#/account/portfolio`: селектор меняет кривую и breakdown, таблицы истории переключаются, на 390px — стопка.

- [ ] **Step 4: Коммит**

```bash
git add src/features/account/PortfolioTab.tsx src/features/account/AccountPage.tsx
git commit -m "feat(account): вкладка Portfolio — кривая PnL, breakdown по периоду, таблицы истории

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Вкладка Assets; диалоги с предвыбранным токеном; уборка `AccountPanel`

**Files:**
- Create: `src/features/account/AssetsTab.tsx`
- Modify: `src/features/account/DepositDialog.tsx`, `src/features/account/WithdrawDialog.tsx` (проп `initialSymbol`)
- Modify: `src/features/account/AccountPanel.tsx` (убрать мёртвые `depositOpen`/`withdrawOpen` и диалоги)
- Modify: `src/features/account/AccountPage.tsx` (`case "assets"`)

**Interfaces:**
- Consumes: `useCollateralBalances` (Task 4); `Panel` (Task 5); `Table*` из `@/components/ui/table`; `useCollateralAmountQuery`, `useDepositableBalance`, `useNetworkId` из `@liq/react`; `formatQty`, `formatUsd`, `getChainConfig`, `getCollaterals` из `@liq/core`.
- Produces: `AssetsTab()`; `DepositDialog`/`WithdrawDialog` принимают `initialSymbol?: string`.

- [ ] **Step 1: Проп `initialSymbol` в обоих диалогах**

В `DepositDialog.tsx` и `WithdrawDialog.tsx` одинаково:

```tsx
export function DepositDialog({
  open,
  onClose,
  initialSymbol,
}: {
  open: boolean;
  onClose: () => void;
  /** Токен, с которого открывается диалог (строка Assets); иначе — первый контура. */
  initialSymbol?: string;
}) {
  // …
  const symbols = Object.keys(collaterals);
  // Начальное значение читается один раз: вызывающий, которому нужен другой
  // токен на повторном открытии, перемонтирует диалог через `key`.
  const [symbol, setSymbol] = useState(
    initialSymbol !== undefined && symbols.includes(initialSymbol)
      ? initialSymbol
      : symbols[0],
  );
```

- [ ] **Step 2: Уборка `AccountPanel.tsx`**

Удалить `useState`, `DepositDialog`, `WithdrawDialog` из импортов, оба `useState(false)` и оба `<…Dialog …/>` из JSX. Компонент остаётся карточкой из пяти строк.

- [ ] **Step 3: Вкладка Assets**

```tsx
// src/features/account/AssetsTab.tsx
import { formatQty, formatUsd, getChainConfig, getCollaterals } from "@liq/core";
import {
  useCollateralAmountQuery,
  useDepositableBalance,
  useNetworkId,
} from "@liq/react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DASH } from "../../lib/format";
import { Panel } from "./AccountCards";
import { DepositDialog } from "./DepositDialog";
import { useCollateralBalances } from "./useCollateralBalances";
import { WithdrawDialog } from "./WithdrawDialog";

type Dialog = { kind: "deposit" | "withdraw"; symbol: string } | null;

/** Коллатералы контура строками; итог — из того же кеша, что и строки. */
export function AssetsTab() {
  const networkId = useNetworkId();
  const collaterals = getCollaterals(getChainConfig(networkId));
  const { totalWad } = useCollateralBalances();
  const [dialog, setDialog] = useState<Dialog>(null);

  return (
    <Panel className="flex flex-col gap-3" testid="assets-panel">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Assets</h2>
        <span className="text-xs text-muted">
          Total collateral:{" "}
          <span className="font-semibold text-text tabular-nums" data-testid="assets-total">
            {totalWad === undefined ? DASH : formatUsd(totalWad)}
          </span>
        </span>
      </div>
      <Table data-testid="assets-table" containerClassName="overflow-x-auto">
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead>In account</TableHead>
            <TableHead>In wallet</TableHead>
            <TableHead>USD value</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(collaterals).map(([symbol, c]) => (
            <AssetRow
              key={symbol}
              symbol={symbol}
              marketId={BigInt(c.marketId)}
              onDeposit={() => setDialog({ kind: "deposit", symbol })}
              onWithdraw={() => setDialog({ kind: "withdraw", symbol })}
            />
          ))}
        </TableBody>
      </Table>
      {/* `key` по токену: диалог читает initialSymbol один раз при монтировании. */}
      <DepositDialog
        key={`deposit-${dialog?.symbol ?? ""}`}
        open={dialog?.kind === "deposit"}
        initialSymbol={dialog?.symbol}
        onClose={() => setDialog(null)}
      />
      <WithdrawDialog
        key={`withdraw-${dialog?.symbol ?? ""}`}
        open={dialog?.kind === "withdraw"}
        initialSymbol={dialog?.symbol}
        onClose={() => setDialog(null)}
      />
    </Panel>
  );
}

function AssetRow({
  symbol,
  marketId,
  onDeposit,
  onWithdraw,
}: {
  symbol: string;
  marketId: bigint;
  onDeposit: () => void;
  onWithdraw: () => void;
}) {
  const { data: held } = useCollateralAmountQuery(marketId);
  const { data: wallet } = useDepositableBalance(symbol);
  return (
    <TableRow data-testid={`asset-row-${symbol}`}>
      <TableCell className="font-semibold">{symbol}</TableCell>
      <TableCell className="tabular-nums" data-testid={`asset-held-${symbol}`}>
        {held === undefined ? DASH : `${formatQty(held)} ${symbol}`}
      </TableCell>
      <TableCell className="tabular-nums">
        {wallet === undefined ? DASH : `${formatQty(wallet.total)} ${symbol}`}
      </TableCell>
      {/* Стейблы 1:1 к доллару — USD value равен остатку. */}
      <TableCell className="tabular-nums">
        {held === undefined ? DASH : formatUsd(held)}
      </TableCell>
      <TableCell className="text-right">
        <button
          type="button"
          onClick={onDeposit}
          aria-label={`Deposit ${symbol}`}
          data-testid={`asset-deposit-${symbol}`}
          className="mr-2 text-accent hover:brightness-110"
        >
          <ArrowDownToLine size={16} />
        </button>
        <button
          type="button"
          onClick={onWithdraw}
          aria-label={`Withdraw ${symbol}`}
          data-testid={`asset-withdraw-${symbol}`}
          className="text-muted hover:text-text"
        >
          <ArrowUpFromLine size={16} />
        </button>
      </TableCell>
    </TableRow>
  );
}
```

Если `Table` не принимает `containerClassName` — посмотреть его сигнатуру в `src/components/ui/table.tsx` и использовать то, что там есть (в `DataTable` он передаётся, так что проп существует).

- [ ] **Step 4: Подключить в `AccountPage.tsx`**

```tsx
import { AssetsTab } from "./AssetsTab";
// …
    case "assets":
      return <AssetsTab />;
```

- [ ] **Step 5: Проверить**

Run: `pnpm typecheck && pnpm lint && pnpm test`; `pnpm dev` → `#/account/assets`: строки USDC/USDm, иконка депозита открывает диалог с заголовком «Deposit USDm» для строки USDm; `pnpm test:e2e -- e2e/tier1/03-deposit-withdraw.spec.ts e2e/tier1/24-account-panel.spec.ts` — зелёные (диалоги и карточка не сломаны).

- [ ] **Step 6: Коммит**

```bash
git add src/features/account/AssetsTab.tsx src/features/account/DepositDialog.tsx src/features/account/WithdrawDialog.tsx src/features/account/AccountPanel.tsx src/features/account/AccountPage.tsx
git commit -m "feat(account): вкладка Assets — коллатералы контура с депозитом и выводом по строке

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Вкладка Transactions

**Files:**
- Create: `src/features/account/TransactionsTab.tsx`
- Modify: `src/features/account/AccountPage.tsx` (`case "transactions"`)

**Interfaces:**
- Consumes: `DataTable`, `MARKET_COLUMN_ID` из `@/components/data-table/DataTable`; `features`, `marketFilterFn` из `@/components/data-table/features`; `Panel`, `PeriodSelect` (Task 5); `activityRows`, `withinWindow`, `filterActivity`, `activityCsv`, `periodWindow`, `ACTIVITY_LABEL`, типы (Task 3); `fmtSignedUsdNum`, `fmtTime`, `DASH`; `marketSymbol`, `useSelectedMarket`.
- Produces: `TransactionsTab()`.

- [ ] **Step 1: Компонент**

```tsx
// src/features/account/TransactionsTab.tsx
import type { PortfolioPeriod } from "@liq/api-client";
import { truncateAddress } from "@liq/core";
import {
  useAccountId,
  usePortfolioQuery,
  useSettlementLedgerQuery,
} from "@liq/react";
import { createColumnHelper } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable, MARKET_COLUMN_ID } from "@/components/data-table/DataTable";
import { features, marketFilterFn } from "@/components/data-table/features";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { DASH, fmtSignedUsdNum, fmtTime } from "../../lib/format";
import { marketSymbol, useSelectedMarket } from "../market/useSelectedMarket";
import { Panel, PeriodSelect } from "./AccountCards";
import {
  ACTIVITY_LABEL,
  activityCsv,
  activityRows,
  filterActivity,
  periodWindow,
  withinWindow,
  type ActivityKind,
  type ActivityRow,
} from "./accountPage";

/** ponytail: первые 200 расчётов за период; пагинация по nextCursor — когда их станет больше. */
const LEDGER_PAGE = 200;

type Kind = ActivityKind | "all";
const KINDS: readonly Kind[] = ["all", "deposit", "withdrawal", "trade", "liquidation"];
const KIND_LABEL: Record<Kind, string> = {
  all: "All types",
  deposit: "Deposits",
  withdrawal: "Withdrawals",
  trade: "Trades",
  liquidation: "Liquidations",
};

interface Row {
  row: ActivityRow;
  /** Символ рынка; пустая строка у депозитов и выводов. */
  symbol: string;
}

const helper = createColumnHelper<typeof features, Row>();

const columns = helper.columns([
  helper.accessor((r) => r.row.timestampMs, {
    id: "time",
    header: "Time",
    cell: (info) => <span className="text-muted">{fmtTime(info.getValue())}</span>,
  }),
  helper.accessor((r) => r.row.kind, {
    id: "type",
    header: "Type",
    cell: (info) => (
      <span className={info.getValue() === "liquidation" ? "text-short" : undefined}>
        {ACTIVITY_LABEL[info.getValue()]}
      </span>
    ),
  }),
  helper.accessor((r) => r.symbol, {
    id: MARKET_COLUMN_ID,
    header: "Market",
    enableHiding: false,
    // Депозиты рынка не имеют: при выбранном рынке они скрываются, при «все» — видны.
    filterFn: (row, _id, value) =>
      marketFilterFn(row.original.row.marketId?.toString() ?? "", value),
    cell: (info) =>
      info.getValue() ? (
        <span className="font-semibold">{info.getValue()}</span>
      ) : (
        <span className="text-muted">{DASH}</span>
      ),
  }),
  helper.accessor((r) => r.row.amountUsd ?? 0, {
    id: "amount",
    header: "Amount",
    cell: (info) => {
      const v = info.row.original.row.amountUsd;
      if (v === null) return <span className="text-muted">{DASH}</span>;
      return (
        <span className={v < 0 ? "text-short" : "text-long"}>{fmtSignedUsdNum(v)}</span>
      );
    },
  }),
  helper.accessor((r) => r.row.txHash ?? "", {
    id: "tx",
    header: "Tx",
    cell: (info) => (
      <span className="text-muted">
        {info.getValue() ? truncateAddress(info.getValue()) : DASH}
      </span>
    ),
  }),
]);

export function TransactionsTab() {
  const accountId = useAccountId();
  const { markets } = useSelectedMarket();
  const [period, setPeriod] = useState<PortfolioPeriod>("30d");
  const [now, setNow] = useState(() => Date.now());
  const [kind, setKind] = useState<Kind>("all");
  const range = useMemo(() => periodWindow(period, now), [period, now]);

  const { data: portfolio, isLoading: portfolioLoading } = usePortfolioQuery(
    accountId,
    period,
  );
  const { data: ledger, isLoading: ledgerLoading } = useSettlementLedgerQuery(
    accountId,
    { ...range, limit: LEDGER_PAGE },
  );

  const rows = useMemo<Row[]>(() => {
    const events = portfolio?.available ? portfolio.collateralEvents : [];
    const all = withinWindow(activityRows(events, ledger?.rows ?? []), range);
    return filterActivity(all, kind).map((row) => ({
      row,
      symbol: row.marketId === undefined ? "" : marketSymbol(markets, row.marketId),
    }));
  }, [portfolio, ledger, range, kind, markets]);

  function exportCsv() {
    const csv = activityCsv(
      rows.map((r) => r.row),
      (id) => marketSymbol(markets, id),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `account-transactions-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Panel className="flex min-h-[420px] flex-col gap-3" testid="transactions-panel">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Transactions</h2>
        <div className="flex-1" />
        <Select value={kind} onValueChange={(next) => setKind(next as Kind)}>
          <SelectTrigger size="sm" className="h-7 text-xs" data-testid="transactions-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => (
              <SelectItem key={k} value={k} data-testid={`transactions-type-${k}`}>
                {KIND_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <PeriodSelect
          value={period}
          onChange={(next) => {
            setPeriod(next);
            setNow(Date.now());
          }}
          testid="transactions-period"
        />
        <Button
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={exportCsv}
          disabled={rows.length === 0}
          data-testid="transactions-export"
        >
          <Download size={14} /> CSV
        </Button>
      </div>
      <DataTable
        data={rows}
        columns={columns}
        testid="transactions-table"
        rowId={(r) => r.row.id}
        loading={portfolioLoading || ledgerLoading}
        emptyText="No transactions in this period."
      />
    </Panel>
  );
}
```

- [ ] **Step 2: Подключить в `AccountPage.tsx`** — `case "transactions": return <TransactionsTab />;` и убрать `default: return null` вместе с комментарием (все четыре вкладки на месте; `switch` исчерпывающий).

- [ ] **Step 3: Проверить**

Run: `pnpm typecheck && pnpm lint && pnpm test`; `pnpm dev` → `#/account/transactions`: фильтр типа и период меняют строки, CSV скачивается с пятью колонками.

- [ ] **Step 4: Коммит**

```bash
git add src/features/account/TransactionsTab.tsx src/features/account/AccountPage.tsx
git commit -m "feat(account): вкладка Transactions — депозиты, выводы и расчёты с фильтрами и CSV

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Tier-1 e2e и README

**Files:**
- Modify: `e2e/support/world.ts` (`WirePortfolio`, `MockWorld.portfolio`, `ScenarioOptions.portfolio`, `defaultPortfolio()`)
- Modify: `e2e/support/mockGateway.ts` (маршрут `/accounts/:id/portfolio`)
- Create: `e2e/pages/AccountPage.ts`
- Create: `e2e/tier1/30-account-page.spec.ts`
- Modify: `README.md` («Where things live»)

**Interfaces:**
- Consumes: testid из Task 5–8: `nav-account`, `nav-trade`, `account-page`, `account-tab-<slug>`, `account-stat-value`, `today-pnl`, `recent-activity-row`, `asset-row-USDC`, `transactions-table`, `transactions-table-row-<id>`, `transactions-type`, `transactions-type-deposit`, `transactions-period`, `transactions-period-all`, `terminal-root`.
- Produces: `WirePortfolio`, `defaultPortfolio()`, page object `AccountPage`.

- [ ] **Step 1: Мир и фикстура** — в `e2e/support/world.ts`:

```ts
/** Ответ `GET /accounts/:id/portfolio` без полей, которые мок дописывает сам. */
export interface WirePortfolio {
  available: boolean;
  points: Array<{
    timestamp: number;
    equityUsd: number;
    realizedPnlUsd: number;
    unrealizedPnlUsd: number;
    netDepositsUsd: number;
  }>;
  summary: {
    realizedPnlUsd: number;
    fundingUsd: number;
    feesUsd: number;
    volumeUsd: number;
    netDepositsUsd: number;
    maxDrawdownPct: number | null;
    estimated: boolean;
  };
  collateralEvents: Array<{
    timestamp: number;
    amountUsd: number;
    type: "deposit" | "withdrawal";
    collateralId: string;
  }>;
}

/** Две точки (+$120 заработано) и один депозит — минимум, на котором видны все плитки. */
export function defaultPortfolio(): WirePortfolio {
  return {
    available: true,
    points: [
      { timestamp: 1_717_113_600, equityUsd: 5_000, realizedPnlUsd: 0, unrealizedPnlUsd: 0, netDepositsUsd: 5_000 },
      { timestamp: 1_717_200_000, equityUsd: 5_120, realizedPnlUsd: 120, unrealizedPnlUsd: 0, netDepositsUsd: 5_000 },
    ],
    summary: {
      realizedPnlUsd: 120,
      fundingUsd: -2,
      feesUsd: 1,
      volumeUsd: 1_280_000,
      netDepositsUsd: 5_000,
      maxDrawdownPct: null,
      estimated: false,
    },
    collateralEvents: [
      { timestamp: 1_717_113_600, amountUsd: 2_500, type: "deposit", collateralId: "2" },
    ],
  };
}
```

В `MockWorld` после `accountMargin`: `/** `GET /accounts/:id/portfolio` — кривая, lifetime-сводка, депозиты/выводы. */ portfolio: WirePortfolio;`. В `ScenarioOptions`: `portfolio?: WirePortfolio;`. В `freshWorld()` рядом с `accountMargin`: `portfolio: opts.portfolio ?? defaultPortfolio(),`.

- [ ] **Step 2: Маршрут мока** — в `e2e/support/mockGateway.ts`, в блоке `// --- accounts` перед `const register`:

```ts
    const portfolio = path.match(/\/accounts\/([^/]+)\/portfolio$/);
    if (portfolio) {
      await send(route, {
        accountId: portfolio[1],
        period: url.searchParams.get("period") ?? "all",
        generatedAt: Math.floor(Date.now() / 1000),
        ...world.portfolio,
        coverage: {
          eventsComplete: true,
          oldestEventAt: world.portfolio.points[0]?.timestamp ?? null,
          inferredOpeningPositions: 0,
          bucketsMissingMark: 0,
          firstBucketMissingMarkAt: null,
        },
      });
      return;
    }
```

- [ ] **Step 3: Page object**

```ts
// e2e/pages/AccountPage.ts
import { expect, type Locator, type Page } from "@playwright/test";

/** Страница `#/account`: навигация из шапки, вкладки, плитки, таблицы. */
export class AccountPage {
  constructor(private readonly page: Page) {}

  get root(): Locator {
    return this.page.getByTestId("account-page");
  }
  get navLink(): Locator {
    return this.page.getByTestId("nav-account");
  }
  get tradeLink(): Locator {
    return this.page.getByTestId("nav-trade");
  }
  tab(slug: string): Locator {
    return this.page.getByTestId(`account-tab-${slug}`);
  }
  stat(slug: string): Locator {
    return this.page.getByTestId(`account-stat-${slug}`);
  }
  get todayPnl(): Locator {
    return this.page.getByTestId("today-pnl");
  }
  get activityRows(): Locator {
    return this.page.getByTestId("recent-activity-row");
  }
  assetRow(symbol: string): Locator {
    return this.page.getByTestId(`asset-row-${symbol}`);
  }
  get transactionsTable(): Locator {
    return this.page.getByTestId("transactions-table");
  }
  get transactionRows(): Locator {
    return this.page.locator('[data-testid^="transactions-table-row-"]');
  }

  /** Ссылка в шапке → страница на экране. */
  async open(): Promise<void> {
    await this.navLink.click();
    await expect(this.root).toBeVisible();
  }

  /** Radix Select: открыть триггер, выбрать пункт `${trigger}-${value}`. */
  async select(trigger: string, value: string): Promise<void> {
    await this.page.getByTestId(trigger).click();
    await this.page.getByTestId(`${trigger}-${value}`).click();
  }
}
```

- [ ] **Step 4: Спека**

```ts
// e2e/tier1/30-account-page.spec.ts
import { AccountPage } from "../pages/AccountPage";
import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";
import { ledgerRowFixture, readyWorld } from "../support/world";

test.describe("страница Account", () => {
  test("ссылка в шапке открывает страницу с четырьмя вкладками", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    const account = new AccountPage(page);
    await account.open();

    await expect(page).toHaveURL(/#\/account$/);
    for (const slug of ["overview", "portfolio", "assets", "transactions"]) {
      await expect(account.tab(slug)).toBeVisible();
    }
    await expect(account.tab("overview")).toHaveAttribute("aria-current", "page");
    // Терминал размонтирован: на странице счёта его корня нет.
    await expect(page.getByTestId("terminal-root")).toHaveCount(0);
  });

  test("Overview: стоимость счёта, PnL за день и депозит в ленте", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    const account = new AccountPage(page);
    await account.open();

    // getAvailableMargin из readyWorld — 5 000.
    await expect(account.stat("value")).toHaveText("$5,000.00");
    // Две точки фикстуры: заработано 120 при старте 5 000 → +2.40%.
    await expect(account.todayPnl).toHaveText("+$120.00 (+2.40%)");
    await expect(account.activityRows.first()).toContainText("Deposit");
    await expect(account.activityRows.first()).toContainText("+$2,500.00");
  });

  test("Assets: строка USDC показывает остаток на аккаунте", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    const account = new AccountPage(page);
    await account.open();
    await account.tab("assets").click();

    // Мок-чейн отвечает на getCollateralAmount всем available аккаунта (5 000).
    await expect(account.assetRow("USDC")).toContainText("5,000");
  });

  test("Transactions: фильтр по типу оставляет только депозиты", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world, () =>
      readyWorld({ settlementLedger: [ledgerRowFixture()] }),
    );
    const account = new AccountPage(page);
    await account.open();
    await account.tab("transactions").click();

    // Фикстуры датированы 2024-м: окно 30 дней их не видит, берём всё время.
    await account.select("transactions-period", "all");
    await expect(account.transactionRows).toHaveCount(2);
    await expect(account.transactionsTable).toContainText("Trade");

    await account.select("transactions-type", "deposit");
    await expect(account.transactionRows).toHaveCount(1);
    await expect(account.transactionRows.first()).toContainText("Deposit");
  });

  test("ссылка Trade возвращает терминал", async ({ page, world }) => {
    await enterTerminal(page, world);
    const account = new AccountPage(page);
    await account.open();

    await account.tradeLink.click();
    await expect(page.getByTestId("terminal-root")).toBeVisible();
    await expect(account.root).toHaveCount(0);
  });
});
```

- [ ] **Step 5: Прогнать e2e**

Run: `pnpm test:e2e -- e2e/tier1/30-account-page.spec.ts`
Expected: 5 passed. Если Radix Select не открывается кликом по триггеру — использовать `await this.page.getByTestId(trigger).press("Enter")` вместо `click()` в `select()`. Если `today-pnl` не совпадает — сверить `windowPnl` с точками фикстуры (5 120 − 5 000 − (5 000 − 5 000) = 120; 120 / 5 000 = 2.40%).

Затем весь tier1: `pnpm test:e2e` — прежние 24 спеки зелёные (без хеша маршрут — trade).

- [ ] **Step 6: README** — в разделе «Where things live» после строки про `src/features/<name>/`:

```md
- `#/account` — full-screen Account page (`src/features/account/AccountPage.tsx`): Overview /
  Portfolio / Assets / Transactions on live SDK reads; hash routing in `src/lib/hashRoute.ts`, no
  router dependency.
```

- [ ] **Step 7: Коммит**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add e2e/support/world.ts e2e/support/mockGateway.ts e2e/pages/AccountPage.ts e2e/tier1/30-account-page.spec.ts README.md
git commit -m "test(e2e): страница Account — навигация, Overview, Assets, фильтр Transactions; мок /portfolio

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Завершение

После Task 9: `git push -u origin feat-cld/account-page`, затем draft PR в `main`:

```bash
gh pr create --draft --base main --title "feat(account): страница Account — четыре вкладки на живых данных SDK" --body-file <(cat <<'PR'
Полноэкранная страница `#/account` по макету Figma «Liqu — Trading Flows / Account»: Overview, Portfolio, Assets, Transactions на живых данных `@liq/*@0.50`; хеш-роутинг без зависимостей; Security и Sessions отложены отдельной задачей.

Спека: `docs/superpowers/specs/2026-09-13-account-page-design.md`. План: `docs/superpowers/plans/2026-09-13-account-page.md`.

Проверка: `pnpm typecheck && pnpm lint && pnpm test`, `pnpm test:e2e` (25 спек, +`30-account-page`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
PR
)
```
