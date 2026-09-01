# Трейд-ядро эталонного терминала — дизайн

**Дата:** 2026-09-01
**Статус:** утверждён
**Ветка:** `feat-cld/terminal-trade-core`
**Референс:** макет «Liqu — Trading Flows» (18 фреймов, `monorepo/Trading_Flows/Frame*.png`),
реализация `perps/Liqu`, пакеты `monorepo/packages/liq-*`

## Задача

Терминал сегодня показывает минимальный путь сделки: шапка рынка, свеча, форма ордера,
три вкладки (позиции, ордера, история). Макет рисует полноценный экран Trade: стакан с
группировкой по тику, лента сделок, тикет с флагами исполнения, панель счёта и **семь**
нижних вкладок. Между тем почти всё, что макету нужно, уже лежит значением в `liq-*` —
терминал просто до этого не дотянулся.

Цель: довести экран Trade до макета, не написав ни одной доменной функции в терминале и не
собрав ни одного UI-примитива вручную.

## Охват

**В охвате:** экран Trade целиком — шапка рынка, выбор рынка, вкладки рынков, чарт,
стакан, лента сделок, тикет, панель Account, семь нижних вкладок.

**Вне охвата:** разделы Portfolio / Staking / Referrals / Points (это продукт Liqu, не эталон);
панель инструментов рисования на чарте; Cross/Isolated; раскрытие «Pro» в тикете.

## Решения

### Логика живёт в `liq-*`, экран — в терминале

Любая доменная величина, которой нет в SDK, пишется **в `monorepo/packages/liq-*`** и
приходит в терминал релизом. Терминал форматирует и раскладывает; он не выводит новых
доменных величин.

Показательный случай — стакан. `markets.orderbook` отдаёт книгу целиком, и его TSDoc прямо
говорит: «capping the level count is the caller's policy». Соблазн посчитать группировку по
тику прямо в компоненте велик, но группировка и кумулятивная глубина — это ответ на вопрос
предметной области, а не раскладка пикселей: та же функция уже написана второй раз в
`Liqu/src/hooks/useOrderBook.ts`. Третьей копии не будет.

### Состояние — то, что уже есть в SDK

`zustand` — прямая зависимость `liq-react`, и `useTradeStore` (side, orderType, size, price)
там уже живёт, как и `useGatewayStore` с `useTransactionStore`. Терминал берёт их как есть.
Собственный `zustand`-стор заводится **только** на то, чего в SDK нет по смыслу: состояние
экрана — избранные рынки, открытые вкладки рынков, шаг тика, режим стакана, видимость
колонок, свёрнутость панелей. Он под `persist`, чтобы не писать `localStorage` руками.

`react-hook-form` не берём: поля тикета взаимозависимы (qty ⇄ % ⇄ notional ⇄ leverage) и уже
принадлежат стору SDK — форма стала бы вторым источником истины.

### UI — radix через shadcn/ui

Компоненты ставятся `shadcn` CLI в `src/components/ui` (режим Tailwind v4). Нынешние
самописные `Button`, `Card`, `Input`, `Dialog` удаляются. `DecimalInput` остаётся: он не
примитив, а санитайзер ввода (`/^\d*\.?\d{0,maxDecimals}$/`), и переезжает внутрь shadcn
`Input`.

Готовое вместо своего и за пределами примитивов:

| Задача | Библиотека |
| --- | --- |
| чтения и мутации | `@tanstack/react-query` через хуки `@liq/react` |
| семь таблиц: колонки, сортировка, видимость, фильтр | `@tanstack/react-table` |
| стакан и длинные списки | `@tanstack/react-virtual` |
| три колонки, свёртка чарта, фуллскрин таблицы | `react-resizable-panels` (shadcn `Resizable`) |
| Tabs, Select, Dialog, Checkbox, Slider, Tooltip, ToggleGroup, Popover, ScrollArea, Command | `radix-ui` через `shadcn/ui` |
| иконки | `lucide-react` |
| даты историй | `date-fns` |

### Чарт остаётся на `lightweight-charts`

Макет рисует TradingView Advanced Charts — так и сделано в Liqu (`public/charting_library`).
Эталон под Apache-2.0 должен клонироваться и запускаться без заявки в TradingView, поэтому из
макета берётся функциональная рамка (таймфреймы, `%`/`log`/`auto`, фуллскрин), а панель
рисования — нет.

### Контракт `data-testid` — инвариант

17 спек tier-1 и 7 live-спек ходят по `data-testid`. Каждый существующий идентификатор
переносится на новую разметку без переименования; новые блоки получают новые. Зелёный e2e
после Ф0 — доказательство, что редизайн не изменил поведение.

### Подписи валют — из конфигурации, не из макета

Макет подписан `USDT`; контур торгует `sUSD`/`USDC`. Тикеры берутся из рынка и конфигурации
SDK, а не переносятся с картинки.

## Карта данных

| Блок макета | Источник | Состояние |
| --- | --- | --- |
| Шапка: mark/spot, funding + countdown, OI, 24h volume | `useMarketsFullRestQuery`, `usePricesQuery`, `markets.getFunding` | есть |
| Выбор рынка: поиск, Last / Change / Volume / Market Cap | `useMarketsFullRestQuery` | есть; избранное — стор экрана |
| Стакан: тик, кумулятив, spread, 50/50 | `markets.orderbook`, `useMarketChannel('orderbook')` | **добавка в `liq-*`** |
| Лента сделок | `useTradesRestQuery`, `useMarketChannel('trades')` | есть; Maker/Taker — сравнение с `accountId` |
| Тикет: типы ордеров, POST / IOC / RO, TIF | `OrderType`×6, `TimeInForce`, `postOnly`/`reduceOnly` в EIP-712, `useSubmit*` | есть |
| Сводка тикета: value, Cost, Liq. price | `useOrderMarginPreview`, `useTradePreview`, `calcLiquidationPrice` | есть |
| Account: PnL, Value, Equity, Exposure, Leverage | `usePortfolioQuery`, `accounts.getMargin` | есть |
| Positions / Open Orders | `useEnrichedPositions`, `useOpenOrdersQuery`, `orders.count` | есть |
| Trade History | `trades.list` (`fee`, `settlementFee`, `realizedPnl`) | есть |
| Order History | `orders.list`, `OrderStatus` | есть |
| Position History | `accounts.getPositionHistory` | есть; Close Type различает `trade` и `liquidation`, но не Market и Limit |
| Account History | `accounts.getSettlementLedger` | есть |
| Funding History | тот же леджер, строки с `accruedFunding ≠ 0` | платёж есть, ставка на момент платежа — нет, колонка рисуется прочерком |
| Cross / Isolated | `marginMode` в SDK отсутствует | вне охвата |
| «Pro» в тикете | содержимое в макете не раскрыто | вне охвата |

Прочерк там, где данных нет, — обязателен: подставленный ноль в колонке ставки читается как
измеренная величина.

## Фазы

Ветка и draft-PR на фазу, в `liqu-fi/terminal`. Порядок фиксирован: каждая следующая фаза
опирается на оболочку и примитивы предыдущей.

### Ф0 · Фундамент

Терминал. Alias `@/` в `vite.config.ts` и `tsconfig.app.json`, `components.json`, `shadcn init`
под Tailwind v4; замена четырёх примитивов; `Resizable`-оболочка экрана (три колонки + нижняя
панель, свёртка чарта — Frame-12, фуллскрин таблицы — Frame-13); палитра токенов под макет;
стор экрана на `zustand` + `persist`. Новых данных не появляется.

Отдельно в этой же фазе — гигиена: два коммита обновления SDK до 0.42.0 сейчас не влиты в
`origin/main`, а ветка, на которой они лежат, на remote удалена. Они уходят в тот же PR.

**Гейт фазы:** все 17 спек tier-1 зелёные без правки локаторов.

### Ф1 · Стакан и лента сделок

Сначала `monorepo`: `aggregateBook({ bids, asks }, { tick, depth })` в `liq-core` (группировка
по шагу цены, кумулятивные суммы, спред) и `useOrderbook(marketId, { tick, depth })` в
`liq-react` поверх `useMarketChannel('orderbook')`; следующий минорный релиз SDK в оба
реестра. Номер здесь не фиксируется: пакеты в `monorepo` уже стоят на 0.43.0, а терминал —
на 0.42.0, поэтому подъём зависимости входит в эту же фазу и берёт ту версию, которая выйдет.

Затем терминал: панель Order Book / Trades — селектор шага тика, три режима отображения
(обе стороны, только биды, только аски), спред, кумулятивные бары, полоса 50/50,
виртуализация, клик по уровню кладёт цену в `useTradeStore`.

### Ф2 · Тикет по макету

Market / Limit, кнопка MID, переключатель единиц количества, ступенчатый слайдер (radix
`Slider`), флаги Post Only / IOC / Reduce Only / TP-SL, сводка Order qty · value · Cost ·
Liq. price, две кнопки Buy/Long и Sell/Short вместо нынешней одной. Математика — существующий
`orderMath` и `useOrderMarginPreview`; новых вычислений в терминале не появляется.

### Ф3 · Семь историй и панель Account

`@tanstack/react-table` на Positions, Open Orders, Trade History, Order History, Position
History, Funding History, Account History: колонки, сортировка, видимость колонок, фильтр,
фуллскрин. Панель Account из `usePortfolioQuery` и `accounts.getMargin`.

### Ф4 · Шапка, выбор рынка, вкладки рынков, рамка чарта

`Command`-поиск рынка с избранным, вкладки открытых рынков, OI / 24h volume / countdown
фандинга, таймфреймы и `%`/`log`/`auto` на `lightweight-charts`.

## Тесты

- **Юнит в `monorepo`:** агрегация книги — группировка по тику, кумулятив, пустая сторона,
  спред при односторонней книге (`bun test`).
- **Юнит в терминале:** мапперы колонок и форматирование. Доменная математика здесь не
  тестируется, потому что здесь её нет.
- **e2e tier-1:** новые спеки на стакан, флаги тикета и семь вкладок; `mockGateway`
  расширяется ручками `orderbook`, `trades`, `settlement-ledger`.
- **e2e tier-2 (live):** в Ф0 не трогаем; в Ф1 и Ф3 добавляем чтение книги и историй на
  staging.

**Гейты на фазу:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e`;
для фаз в `monorepo` — `moon run :test :lint :typecheck` и проверка публикации в оба реестра
(`node scripts/check-release-versions.mjs --registries`).

## Открытые вопросы

- **Cross / Isolated.** Изолированная маржа существует в бэкенде как «аккаунт на рынок», но
  переключателя режима в API нет. Пока блок не рисуется; если понадобится — это арка в
  `monorepo`, а не в терминале.
- **Ставка фандинга в Funding History.** Платёж берётся из леджера, ставка на момент платежа
  не хранится. Колонка рисуется прочерком до тех пор, пока гейтвей не начнёт её отдавать.
