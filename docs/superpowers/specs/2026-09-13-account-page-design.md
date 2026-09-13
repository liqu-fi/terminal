# Страница Account — дизайн

**Дата:** 2026-09-13
**Статус:** утверждён
**Ветка:** `feat-cld/account-page`
**Референс:** Figma «Liqu — Trading Flows», страница *Account* (фреймы `Account / Overview`,
`Account / Portfolio`, `Account / Assets`, `Account / Transactions`, их состояния *No Activity* /
*Logged Out* и мобильные 390×1760); `perps/liqu` `src/features/profile/*` (design-only на моке —
для сверки состава экранов, не для копирования кода); SDK `@liqpro/liq-*@0.50`;
`monorepo/docs/api-reference.md` (§`GET /accounts/:id/margin`, `/portfolio`,
`/settlement-ledger`).

## Задача

Добавить в терминал полноэкранную страницу **Account** с четырьмя вкладками макета — Overview,
Portfolio, Assets, Transactions — на **живых данных SDK**. Сегодня всё, что терминал знает о
счёте, — карточка `AccountPanel` из пяти строк в колонке тикета и число `margin` в шапке рынка;
истории лежат в нижней панели. Страницы, куда можно уйти с торгового экрана, нет: в терминале нет
ни роутера, ни навигации.

Вкладки Security и Sessions макета **отложены** отдельной задачей (решение пользователя,
2026-09-13): у них нет опоры в SDK, кроме пасскеев Turnkey и сессионных ключей 1-click.

## Исходное состояние

| Что | Где | Состояние |
| --- | --- | --- |
| Оболочка экрана | `App.tsx` | шапка «◢ terminal» + `ConnectButton`; `main` рендерит `SessionGate → Terminal` |
| Сводка счёта | `features/account/useAccountSummary.ts` | `summarize()` — чистая, тестирована; читает `getAvailableMargin`, маржу шлюза, долг, позиции |
| Карточка счёта | `features/account/AccountPanel.tsx` | пять строк; держит **неиспользуемые** `depositOpen`/`withdrawOpen` |
| Депозит / вывод | `features/account/{Deposit,Withdraw}Dialog.tsx` | открываются из `MarketHeader`; токен выбирается внутри (`CollateralTabs`) |
| Истории | `features/userinfo/UserInfoTabs.tsx` | семь таблиц на `DataTable`; `fullscreenToggle` уже есть |
| Леджер | `features/history/useAccountLedger.ts` | `useSettlementLedgerQuery(accountId, {limit: 100})` без окна |
| Чарт | `features/chart/CandleChart.tsx` | `createChart` + `cssVar()` для токенов; `autoSize` |
| Состояние экрана | `stores/useTerminalUiStore.ts` | zustand + persist; страниц не знает |
| Онбординг | `features/auth/SessionCta.tsx` | стадии `no-account` / `needs-signin` живут в подвале тикета |
| e2e tier1 | `e2e/tier1/*` (24 спеки) | мок шлюза знает `/margin`, `/settlement-ledger`, `/position-history`; **не знает `/portfolio`** |

SDK уже отдаёт всё, что нужно странице: `usePortfolioQuery(accountId, period)` (кривая
equity/PnL, lifetime-сводка, события депозитов/выводов), `useSettlementLedgerQuery` с окном
`from`/`to` и `totals`, `useCollateralAmountQuery`, `useDepositableBalance`,
`useAvailableMarginQuery` (`available`, `withdrawable`). В терминале ничего из этого не
вычисляется заново — только читается и складывается.

## Принятые решения

| Решение | Выбор | Почему |
| --- | --- | --- |
| Навигация | **URL-хеш** `#/account[/tab]`, свой хук на `hashchange` | ноль зависимостей; deep-link и «назад» бесплатно; react-router ради двух видов — лишний |
| Терминал при уходе на Account | **размонтируется** | кеш react-query переживает; скрытый смонтированный терминал — resizable-panels и `autoSize` чарта в `display:none`, риск без выигрыша |
| Объём вкладок | 4 из 6, только плитки с живыми данными | fee tier, security level, staking, статус/balance-after — без бэкенда; **не рисуются**, не «—» |
| «30D Trading Volume» макета | **«Trading volume · all time»** | `summary` портфеля — lifetime по доке шлюза; трейды без окна `from`/`to` |
| PnL breakdown по периоду | `totals` леджера за окно периода | единственный честно оконный источник; `complete:false` → «≈» |
| Типы транзакций | Deposit / Withdrawal / Trade / Liquidation | у леджера одна строка на расчёт; фандинг внутри неё, отдельная строка удвоила бы сумму |
| Стадии `no-account`/`needs-signin` | тот же `SessionCta` на странице | иначе с `#/account` некуда войти — 401 без кнопки |
| Мобильный | одна колонка через `md:`-брейкпоинты | отдельной раскладки нет; макет 390px — та же стопка |
| Покрытие | vitest на чистые модули + одна tier1-спека | конвенция репозитория: компоненты не тестируются, логика — в `.ts` |

## Не входит в объём

- Вкладки Security и Sessions, модалки 2FA, страница Devices.
- Стейкинг (карточка Staking, «Staked value», «Staking rewards»), fee tier, security level.
- Колонки Status и Balance after в Transactions; браузерные сессии.
- Пагинация леджера дальше первой страницы (`limit: 200`) — см. `ponytail:`-пометку в §5.
- Перенос `AccountPanel` из колонки тикета; он остаётся как есть, лишь теряет мёртвые
  `depositOpen`/`withdrawOpen`.
- Изменения в SDK. Всё, чего нет в `@liq/*`, в объём не входит, а не собирается в терминале.

## §1. Маршрут и оболочка

`src/lib/hashRoute.ts` — один файл: чистый разбор и хук.

```ts
export type AccountTab = "overview" | "portfolio" | "assets" | "transactions";
export type Route = { view: "trade" } | { view: "account"; tab: AccountTab };

export function parseRoute(hash: string): Route;  // "#/account" → overview; "#/account/assets" → assets
export function accountHref(tab: AccountTab): string; // "#/account" | "#/account/<tab>"
export function useHashRoute(): Route;             // useSyncExternalStore("hashchange")
```

Любой неизвестный хеш — `{ view: "trade" }`; хук хеш **не переписывает** (Turnkey OAuth кладёт
`id_token` в хеш; в этой сборке OAuth выключен, но парсер его и так проглотит без вреда).

`App.tsx`: в шапке после бренда — `<nav>` из двух ссылок `Trade` (`#/`) и `Account`
(`#/account`), активная — `aria-current="page"` и `text-text`, остальные `text-muted`; testid
`nav-trade`, `nav-account`. `main` рендерит `route.view === "account" ? <AccountPage tab /> :
<Terminal />` внутри тех же `MarketProvider` и `SessionGate`.

`features/account/AccountPage.tsx` — прокручиваемая колонка (`min-h-0 flex-1 overflow-y-auto`),
внутри `mx-auto w-full max-w-[1200px] p-4`, заголовок «Account», полоса из четырёх ссылок-вкладок
в стиле `TabsList` (testid `account-tab-<slug>`, активная `aria-current`), затем содержимое.
`useSessionStage()`: на `no-account` / `needs-signin` вместо вкладок — карточка с `SessionCta`
(testid `account-session-cta`); остальные стадии до страницы не доходят (`SessionGate`).
Корневой testid `account-page`.

## §2. Данные и чистые вычисления

`features/account/accountLogic.ts` — чистые функции, все под vitest:

| Функция | Вход | Выход |
| --- | --- | --- |
| `periodWindow(period, nowMs)` | `PortfolioPeriod` | `{ from?: Date; to?: Date }`; `all` → без границ |
| `windowPnl(points)` | `PortfolioPoint[]` | `{ pnlUsd, pct \| null } \| undefined`; PnL = Δ(`equityUsd − netDepositsUsd`) между первой и последней точкой; `< 2` точек → `undefined`; `pct = pnl / equity₀` при `equity₀ > 0` |
| `pnlSeries(points)` | `PortfolioPoint[]` | `{ time: UTCTimestamp; value }[]` — `equityUsd − netDepositsUsd`, время в секундах как у шлюза |
| `marginUsage(available, withdrawable)` | WAD `bigint` | `1 − withdrawable/available`, зажато в `[0, 1]`; `available ≤ 0` → `undefined` |
| `activityRows(events, ledger)` | `PortfolioCollateralEvent[]`, `SettlementLedgerRow[]` | `ActivityRow[]`, новые сверху |
| `filterActivity(rows, kind)` | `ActivityKind \| "all"` | подмножество |
| `activityCsv(rows, symbolOf)` | | строка CSV: `time,type,market,amount_usd,tx` |

```ts
export type ActivityKind = "deposit" | "withdrawal" | "trade" | "liquidation";
export interface ActivityRow {
  id: string;            // событие: `${type}-${timestamp}-${collateralId}-${amountUsd}`; леджер: `${txHash}-${logIndex}`
  kind: ActivityKind;
  timestampMs: number;   // событие: timestamp × 1000; леджер: timestampMs
  amountUsd: number | null; // событие: ±amountUsd; леджер: wadToNumber(netBalanceDelta), null → null
  marketId?: bigint;
  txHash?: string;
}
```

Единицы — **две системы, стык только здесь**: портфель отдаёт decimal-`number` и unix-секунды,
леджер и маржа — WAD `bigint` и миллисекунды. В `lib/format.ts` добавляются `fmtUsdNum(n)` и
`fmtSignedUsdNum(n)` (Intl `en-US`, `USD`, 2 знака) — компоненты не вызывают `toFixed`.

`useAccountSummary` расширяется, не дублируется: `summarize()` получает `withdrawable` (ончейн) и
`free` (маржа шлюза, `available − locked`, может быть отрицательной), отдаёт `free` как есть и
считает `marginUsage`. Существующие поля и тесты не меняются.

Данные вкладок читаются хуками SDK напрямую, без обёрток: `usePortfolioQuery(accountId, period)`,
`useSettlementLedgerQuery(accountId, { ...periodWindow(period), limit: 200 })`,
`useCollateralAmountQuery`, `useDepositableBalance`. Итог коллатералов для карточки Assets на
Overview и строки «Total collateral» — `useCollateralBalances()`: `useQueries` с **теми же
ключами** `keys.account.collateral(wallet, id)` и `onchain.collateral.collateralAmount`, что и
хук SDK, — одна запись кеша на токен, строки таблицы и итог не расходятся.

## §3. Overview

Сетка макета, три ряда:

1. **Четыре плитки** (`Stat`: подпись, значение, необязательная ссылка справа):
   Trading volume · all time (`portfolio.summary.volumeUsd`; `available:false` → «—»),
   Account value (`summary.accountValue`), Unrealized PnL (знак и тон), Account leverage
   (`fmtLeverage`). Плитки fee tier и security level макета не рисуются.
2. **Today's PnL** (2/3 ширины): `usePortfolioQuery(accountId, "1d")` → `windowPnl`:
   «+$1,923.40 (+2.03%)» тоном long/short, `summary.estimated` → префикс «≈»; справа кнопки
   Deposit / Withdraw (диалоги те же, что в шапке); ниже `PnlChart` на `pnlSeries` высотой
   `h-56`. Пустая кривая — «No data for today».
   **Recent activity** (1/3): пять верхних `activityRows(events, ledger)`, строка = тип +
   `fmtTime` + сумма со знаком; «View all →» → `#/account/transactions`; пусто → «No recent
   activity yet» (testid `recent-activity-empty`).
3. **Две карточки**: Trading — `equity`, подстрочник «Margin usage N%» (`marginUsage`), «View
   portfolio →»; Assets — Σ `useCollateralBalances()` в USD (стейблы 1:1), подстрочник «N assets»
   (ненулевых), «View assets →». Карточки Staking нет.

Testid плиток: `account-stat-<slug>` (`volume`, `value`, `upnl`, `leverage`), `today-pnl`,
`recent-activity-row`, `account-card-trading`, `account-card-assets`.

## §4. Portfolio

- **Селектор периода** (`Select`: 7d / 30d / 180d / 365d / all, по умолчанию 30d, testid
  `portfolio-period`) управляет **и** кривой, **и** breakdown.
- **Overview-карточка**: Unrealized PnL (+ доля от account value), Portfolio value
  (= account value), Trading volume · all time.
- **Кривая PnL**: `PnlChart` на `pnlSeries(points)` выбранного периода.
- **PnL breakdown** из `useSettlementLedgerQuery(...).totals` за `periodWindow`: Realized
  (`pricePnl`), Funding (`accruedFunding`), Fees (`totalFees`, показывается со знаком минус),
  Net (`netBalanceDelta`) и текущий Unrealized (`summary.unrealizedPnl`, вне периода — так и
  подписан). `totals === null` → «—» по строкам; `complete === false` → «≈» и подстрочник
  «first 200 settlements of the period».
- **Ряд**: Available to trade = `free` шлюза (отрицательное — так и показывается тоном short),
  Margin usage = `marginUsage(available, withdrawable)`.
- **Таблицы**: `<div className="h-[420px]"><UserInfoTabs fullscreenToggle={false} /></div>` —
  те же семь вкладок, что в терминале; `useLiveOrders()` внутри переподписывает SSE, терминал в
  этот момент размонтирован, второй подписки нет.

## §5. Assets и Transactions

**Assets.** Карточка «Assets» с итогом «Total collateral: $X». Таблица на примитивах `ui/table`:
строка на каждый символ из `getCollaterals(getChainConfig(networkId))` — компонент `AssetRow`
зовёт `useCollateralAmountQuery(BigInt(marketId))` и `useDepositableBalance(symbol)`. Колонки:
Asset, In account, In wallet (`total` депонируемого баланса), USD value (= In account, стейблы),
действия — иконки Deposit / Withdraw. Диалоги получают необязательный проп `initialSymbol` и
монтируются с `key={symbol}`, чтобы повторное открытие с другим токеном не тянуло прошлый выбор.
Testid `assets-table`, `asset-row-<symbol>`, `asset-deposit-<symbol>`, `asset-withdraw-<symbol>`.

**Transactions.** Фильтры: Type (`Select`: All / Deposits / Withdrawals / Trades / Liquidations,
testid `transactions-type`), Period (как в §4, testid `transactions-period`), кнопка Export CSV
(`Blob` + `<a download>`; testid `transactions-export`). `DataTable` по образцу
`AccountHistoryTable`: Time (`fmtTime`), Type, Market (`marketSymbol` или «—» для депозитов),
Amount (`fmtSignedUsdNum`, тон по знаку, `null` → «—»), Tx (`truncateAddress` или «—»).
`emptyText` «No transactions in this period.», testid `transactions-table`.

Источники: `collateralEvents` из `usePortfolioQuery(accountId, period)` **плюс** клиентский
фильтр по `periodWindow` (шлюз не обещает окна для событий) и `useSettlementLedgerQuery` с тем же
окном.
`// ponytail: первые 200 строк леджера за период; пагинация по nextCursor — когда у аккаунта
их станет больше.`

## §6. PnlChart

`features/account/PnlChart.tsx`: `createChart(node, { autoSize, layout transparent, grid из
токенов, timeScale })` по образцу `CandleChart` (тот же `cssVar`, вынести в `lib/cssVar.ts`, из
`CandleChart` импортировать), серия `BaselineSeries` с `baseValue: 0`, верх — `--long`, низ —
`--short`. Пропсы: `series: { time; value }[]`, `testid`. Родитель задаёт высоту (`h-56`);
пустой ряд — подпись поверх вместо графика.

## Ошибки и краевые случаи

- `portfolio.available === false`: объём, кривые, Today's PnL, события депозитов — «—» / пусто с
  подписью «Portfolio history is unavailable on this gateway»; леджер, маржа, коллатералы —
  живут.
- `windowPnl` при `< 2` точках — «—», не `$0.00`: пустой день и день без данных — разные вещи.
- `summary.estimated` или `coverage.eventsComplete === false` — «≈» перед суммой и одна строка
  подсказки; чисел не подменяем.
- `accountId === undefined` (стадия `no-account`) — вкладки не монтируются, стоит `SessionCta`.
- `free` шлюза отрицательное — показывается как есть тоном short (дока: `available − locked`
  без транзакционной связи).
- Смена периода при загрузке — предыдущие числа не остаются: `isLoading` → «—».
- Уход с `#/account` на `#/` размонтирует страницу, монтирует терминал; открытые диалоги
  закрываются с ней.
- Ссылки вкладок — настоящие `<a href>`: колесо, средняя кнопка, «назад» работают браузером.

## Тесты

**Vitest** (`src/**/__tests__/*.test.ts`, окружение node):
- `lib/__tests__/hashRoute.test.ts` — `parseRoute` на все четыре вкладки, `#/account`,
  пустой хеш, мусор (`#id_token=…`) → trade; `accountHref` обратен `parseRoute`.
- `features/account/__tests__/accountLogic.test.ts` — `periodWindow` границы и `all`;
  `windowPnl` (Δ с депозитом посреди дня не считается прибылью, `< 2` точек → `undefined`,
  `equity₀ ≤ 0` → `pct: null`); `pnlSeries`; `marginUsage` (зажим, `available ≤ 0`);
  `activityRows` (слияние секунд и миллисекунд, порядок, `netBalanceDelta: null` → `null`,
  liquidation → `liquidation`); `filterActivity`; `activityCsv` (экранирование, «—» для
  отсутствующих).
- `features/account/__tests__/accountSummary.test.ts` — дописать `free` и `marginUsage`.
- `lib/__tests__/format.test.ts` — `fmtUsdNum`, `fmtSignedUsdNum`.

**Tier 1 e2e** — `e2e/tier1/30-account-page.spec.ts` и страница `e2e/pages/AccountPage.ts`:
- `MockWorld.portfolio` (`available`, `points`, `summary`, `collateralEvents`) с фикстурой в
  `readyWorld` (две точки, один депозит); мок-маршрут `/accounts/:id/portfolio` в
  `mockGateway.ts` отдаёт её с `accountId` и `period` из запроса.
- Тесты: (1) ссылка `nav-account` открывает `account-page` с четырьмя вкладками и хешем
  `#/account`; (2) Overview: `account-stat-value` = `$5,000.00` из `readyWorld`, строка депозита
  из фикстуры в Recent activity; (3) Assets: строка USDC показывает то, что мок-чейн отвечает на
  `getCollateralAmount`; (4) Transactions: фильтр Deposits оставляет только депозиты; (5) ссылка
  `nav-trade` возвращает `terminal-root`.
- Существующие 24 спеки не трогаются: без хеша маршрут — trade.

## Карта файлов

| Файл | Действие |
| --- | --- |
| `src/lib/hashRoute.ts` (+ тест) | новый: `parseRoute`, `accountHref`, `useHashRoute` |
| `src/lib/cssVar.ts` | новый: вынесен из `CandleChart.tsx` |
| `src/lib/format.ts` (+ тест) | `fmtUsdNum`, `fmtSignedUsdNum` |
| `src/App.tsx` | nav в шапке; `AccountPage` vs `Terminal` по маршруту |
| `src/features/account/AccountPage.tsx` | новый: оболочка, вкладки, `SessionCta`, `Stat` |
| `src/features/account/OverviewTab.tsx` | новый: §3 |
| `src/features/account/PortfolioTab.tsx` | новый: §4 |
| `src/features/account/AssetsTab.tsx` | новый: §5, `AssetRow` |
| `src/features/account/TransactionsTab.tsx` | новый: §5 |
| `src/features/account/PnlChart.tsx` | новый: §6 |
| `src/features/account/accountLogic.ts` (+ тест) | новый: чистые функции §2 |
| `src/features/account/useCollateralBalances.ts` | новый: `useQueries` на ключах SDK |
| `src/features/account/useAccountSummary.ts` (+ тест) | `withdrawable` → `free`, `marginUsage` |
| `src/features/account/{Deposit,Withdraw}Dialog.tsx` | проп `initialSymbol` |
| `src/features/account/AccountPanel.tsx` | убрать мёртвые `depositOpen`/`withdrawOpen` и диалоги |
| `src/features/chart/CandleChart.tsx` | импорт `cssVar` из `lib` |
| `e2e/support/world.ts`, `e2e/support/mockGateway.ts` | `portfolio` в мире + маршрут |
| `e2e/pages/AccountPage.ts`, `e2e/tier1/30-account-page.spec.ts` | новые |
| `README.md` | строка про `#/account` в «Where things live» |

## Риски

- **`UserInfoTabs` в прокручиваемой странице.** Таблицы меряют себя от flex-родителя; без явной
  высоты обёртки схлопнутся. Отсюда `h-[420px]` в §4; проверяется глазами на 1280×800 и 390px.
- **Двойной SSE.** Терминал и страница обе зовут `useLiveOrders()`; одновременно они не
  смонтированы (§1), а `useSseOrderUpdates` SDK держит одно соединение на документ.
- **Семантика `collateralEvents` по периоду** не описана докой — клиентский фильтр по окну в §5
  делает вкладку детерминированной независимо от поведения шлюза.
- **`BaselineSeries` в lightweight-charts 5** — экспорт есть в `typings.d.ts`; цвета берутся из
  токенов на монтировании, как в `CandleChart`, перекраска темы требует перемонтирования (то же
  ограничение, что у чарта свечей).
