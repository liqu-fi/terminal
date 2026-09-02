# Тикет ордера по макету (Ф2b) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** довести форму ордера терминала до макета — шапка с плечом, поле цены с `MID`,
количество с выбором единиц, ступенчатый слайдер, флаги исполнения, сводка парой
long/short и две кнопки `Buy / Long` — `Sell / Short` вместо одной, — не написав в
терминале ни одной доменной функции.

**Architecture:** доменная арифметика целиком уходит в `@liq/core` (модуль `orderMath`
там уже есть — локальная копия удаляется), подача ордера — в `useOrderSubmission`
из `@liq/react` (три локальные копии хуков удаляются), примитивы UI — shadcn поверх
radix. В терминале остаётся раскладка, форматирование и одна чистая функция сводки,
которая дважды зовёт SDK-оценку ликвидации.

**Tech Stack:** React 19, TypeScript 6, `@liq/*` 0.43.0 → 0.44.0, `radix-ui` через
`shadcn/ui`, `@tanstack/react-query`, `zustand`, Vitest (юниты), Playwright (e2e).

**Spec:** [`docs/superpowers/specs/2026-09-01-trade-core-design.md`](../specs/2026-09-01-trade-core-design.md)
(раздел «Ф2 · Тикет по макету»).
**Разбор макета:** `.superpowers/sdd/f2-ticket-mockup.md` (вне git — читать по пути).

## Global Constraints

- **Доменной логики в терминале не появляется.** Любая арифметика — из `@liq/core`.
  Если нужной функции там нет, это карточка в `monorepo`, а не функция здесь.
- **Свои примитивы UI не писать.** Только `pnpm dlx shadcn@latest add <name>` в
  `src/components/ui/`. После генерации — сверка класс в класс с прежним видом
  (генерация приносит чужие умолчания целиком и молча теряет свои свойства).
- **Ветка:** `feat-cld/trade-ticket` (уже создана, стоит на `origin/main` = `704d3b2`).
  PR — draft, база `main`, репозиторий `liqu-fi/terminal`.
- **Гейт репозитория** (каждая задача заканчивается зелёным):
  `pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build`.
  `pnpm lint` **не использовать** — он резолвится в чужой глобальный ESLint 9.
  e2e: `pnpm test:e2e` (143 спеки на входе в фазу).
- **`data-testid` — контракт.** Снапшот-страж: `src/__tests__/testid-inventory.test.ts`.
  Идентификатор переименовывается только там, где сам блок изменил смысл; каждое
  переименование сопровождается правкой спек, которые по нему ходят.
- **Подписи валют — из рынка и конфигурации**, а не с картинки (макет подписан `USDT`,
  контур торгует `sUSD`/`USDC`).
- **Прочерк там, где данных нет.** Подставленный ноль читается как измеренная величина.
- Комментарии — TSDoc, «почему», а не «что». Русский в докблоках допустим (репозиторий
  двуязычен), английский в идентификаторах.

## Что макет показывает, а чего нет

Все 18 кадров показывают тикет в **одном** состоянии: вкладка `Limit`, дропдауны
закрыты, флажки сняты, слайдер на нуле. В макете **нет** референса для: вкладки
`Market`, раскрытых списков, отмеченного `TP/SL`, disabled-состояний кнопок. Эти места
решаются по существующему поведению терминала, а не додумываются по картинке.

Два блока макета в Ф2 не рисуются:

- **`Cross ▾`** — режима маржи в API нет (`marginMode` отсутствует в SDK); спека
  объявила его вне охвата.
- **`Pro ▾`** — содержимое в макете не раскрыто.

Один рисуется, но неактивным: **`IOC`**. Колонки `timeInForce` в схеме нет, DTO шлюза
срока действия не принимает, и заказанный IOC всегда был GTC. Движок FOK/IOC понимает,
но дотянуть до него значение — арка шлюза и базы. Чекбокс показывается `disabled` с
подсказкой: работающий вид у неработающего флажка — ложь, а его отсутствие скрыло бы,
что в макете он есть.

### Ряд вкладок остаётся четырёхместным

Макет показывает `Market / Limit / Pro ▾`. Терминал держит `Market / Limit /
Stop / Take Profit`, и `Stop` с `Take Profit` остаются на месте: это работающие
виды ордера, которые шлюз принимает, а `Pro ▾` в макете не раскрыт — вероятнее
всего, они там и лежат. Убрать рабочие вкладки ради сходства с картинкой значит
отнять функциональность, которой картинка не противоречит.

### Отступление от спеки: `useOrderMarginPreview` в тикете не появляется

Спека называет источниками счёта «существующий `orderMath` и
`useOrderMarginPreview`». Первое выполняется — счёт идёт из того же модуля,
переехавшего в `@liq/core`. Второе — нет, и намеренно: `useOrderMarginPreview`
отвечает на вопрос **аккаунта** («когда меня ликвидируют») шестью onchain-чтениями
на каждый пересчёт, а сводка макета задаёт вопрос **черновика** («куда мне
нельзя»). На него отвечает `draftLiquidationPrice`, и SDK прямо пишет, что эти
два ответа не сходятся и сходиться не должны. Тикет считает пару long/short на
каждый ввод — платить за неё двенадцатью чтениями цепочки, чтобы получить ответ
на другой вопрос, было бы хуже, а не точнее.

## Расхождение макета, которое в код не переносится

Под полем `Quantity` макет показывает `≈ 2,440.00 USDT` при `1 ETH` и цене ордера
`2446.07`. `1 × 2446.07 = 2 446.07`, а `2 440.00` — это Mark Price из шапки. Пересчёт
берётся от **марка**, а не от введённой лимитной цены: строка отвечает на вопрос
«сколько это стоит сейчас», а не «сколько я предлагаю». Так и делаем — с маркой это
согласуется и с `sizeToUsd`, который весь тикет уже считает от марка.

## Файловая структура

| Файл | Что с ним |
| --- | --- |
| `src/components/ui/select.tsx` | **создать** (shadcn `select`) |
| `src/components/ui/checkbox.tsx` | **создать** (shadcn `checkbox`) |
| `src/components/ui/slider.tsx` | **создать** (shadcn `slider`) |
| `src/components/ui/tooltip.tsx` | **создать** (shadcn `tooltip`) |
| `src/providers/LiqSetup.tsx` | правка: `sessionKey` уходит в `LiqProvider` |
| `src/features/trade/mutations/*` | **удалить** три файла целиком |
| `src/features/trade/orderMath.ts` | **удалить** |
| `src/features/trade/__tests__/orderMath.test.ts` | **удалить** |
| `src/features/trade/useOrderSizing.ts` | правка: арифметика из `@liq/core` |
| `src/features/trade/ticketSummary.ts` | **создать** (чистая пара long/short) |
| `src/features/trade/__tests__/ticketSummary.test.ts` | **создать** |
| `src/features/trade/TicketHeader.tsx` | **создать** (плечо + Available) |
| `src/features/trade/OrderPriceField.tsx` | **создать** (цена + `MID`) |
| `src/features/trade/QuantityField.tsx` | **создать** (заменяет `SizeField.tsx`) |
| `src/features/trade/SizeField.tsx` | **удалить** |
| `src/features/trade/SizeSlider.tsx` | **создать** (заменяет `SizePercent.tsx`) |
| `src/features/trade/SizePercent.tsx` | **удалить** |
| `src/features/trade/ExecutionFlags.tsx` | **создать** |
| `src/features/trade/OrderSummary.tsx` | **создать** |
| `src/features/trade/SubmitButtons.tsx` | **создать** |
| `src/features/trade/TradeForm.tsx` | переписывается как сборка блоков |
| `src/features/trade/TradePreviewRow.tsx` | правка: `totalCost`, `priceImpactRatio`, пара сторон |
| `e2e/tier1/04..07,14,17` | правка локаторов там, где блок изменил смысл |
| `e2e/tier1/22-ticket-flags.spec.ts` | **создать** |

## Порядок

Задачи 1–8 не зависят от релиза SDK. Задача 9 ждёт `@liq/*` 0.44.0
(PR `liqcx/monorepo#728`); до неё чекбокс `Post Only` рисуется и хранит своё состояние,
но на провод не уходит — задача 9 это и закрывает, и её тест это и доказывает.

---

### Задача 1: примитивы shadcn — `select`, `checkbox`, `slider`, `tooltip`

**Файлы:**
- Создать: `src/components/ui/select.tsx`, `src/components/ui/checkbox.tsx`,
  `src/components/ui/slider.tsx`, `src/components/ui/tooltip.tsx`
- Изменить: `package.json`, `pnpm-lock.yaml` (если CLI поставит зависимость)

**Интерфейсы:**
- Отдаёт: `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem`,
  `Checkbox`, `Slider`, `Tooltip`/`TooltipTrigger`/`TooltipContent`/`TooltipProvider`
  — их потребляют задачи 5, 6, 7, 8.

Репозиторий уже держит примитивы shadcn (`button`, `card`, `input`, `dialog`,
`resizable`, `tabs`, `toggle`, `toggle-group`, `dropdown-menu`) и настроен на
объединённый пакет `radix-ui`: сгенерированный файл импортирует
`import { Tabs as TabsPrimitive } from "radix-ui"`, а не `@radix-ui/react-tabs`.
Если CLI выдаст пофичевые импорты — переписать на объединённый пакет и не ставить
пофичевые зависимости.

- [ ] **Шаг 1: сгенерировать четыре примитива**

```bash
cd /Users/alex/Work/perps/terminal
pnpm dlx shadcn@latest add select checkbox slider tooltip
```

- [ ] **Шаг 2: сверить импорты radix**

```bash
grep -n "radix" src/components/ui/{select,checkbox,slider,tooltip}.tsx
```

Ожидание: каждая строка вида `from "radix-ui"`. Любой `@radix-ui/react-*` —
переписать на объединённый пакет:

```ts
import { Select as SelectPrimitive } from "radix-ui";
```

и снять пофичевую зависимость из `package.json`, если CLI её добавил.

- [ ] **Шаг 3: сверить, что вид не уехал**

```bash
git diff --stat
git status --porcelain
```

Ожидание: изменены **только** четыре новых файла плюс, возможно,
`package.json`/`pnpm-lock.yaml`. Если CLI перезаписал `button.tsx`,
`index.css`, `components.json` или `lib/utils.ts` — откатить эти файлы
(`git checkout -- <файл>`): генерация приносит чужие умолчания и молча уносит
свойства, которые Ф0 подбирала под макет.

- [ ] **Шаг 4: гейт**

```bash
pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build
```

Ожидание: зелено. Тестов на примитивы не пишем — это чужой код, у него нет
нашего поведения; проверяем ровно то, что он собирается и проходит линтер.

- [ ] **Шаг 5: коммит**

```bash
git add src/components/ui package.json pnpm-lock.yaml
git commit -m "feat(ui): четыре примитива shadcn под тикет — select, checkbox, slider, tooltip"
```

---

### Задача 2: подача ордера — корпус SDK вместо трёх местных копий

**Файлы:**
- Удалить: `src/features/trade/mutations/useSubmitMarketOrder.ts`,
  `src/features/trade/mutations/useSubmitLimitOrder.ts`,
  `src/features/trade/mutations/useSubmitConditionalOrder.ts` (весь каталог `mutations/`)
- Изменить: `src/providers/LiqSetup.tsx`, `src/features/trade/TradeForm.tsx`
- Тест: `e2e/tier1/07-order-submit.spec.ts`

**Интерфейсы:**
- Потребляет: `TurnkeyProviderWrapper`, `LiqProvider`, `useOrderSubmission` из
  `@liq/react`; тип `OrderDraft` из `@liq/sdk`.
- Отдаёт: в `TradeForm` одна мутация
  `submit: UseMutationResult<SubmitOrderResponse, Error, OrderDraft>` вместо трёх;
  подача — `submit.mutate(draft, { onSuccess })`. Её используют задачи 8 и 9.

Три местные копии существовали ровно по одной причине: `LiqProvider`
монтировался без `sessionKey`, поэтому хуки SDK не видели активного сессионного
ключа и всегда просили кошелёк. Пропс `sessionKey` эту причину снимает — он
публикует активного подписанта через `ActiveSessionSignerContext`, а
`useOrderSigner` в SDK берёт его приоритетом выше кошелька.

**Почему `useOrderSubmission`, а не три хука `useSubmit*Order`.** Флажки макета
до них не доходят: `SubmitMarketOrderInput` и `SubmitLimitOrderInput` не несут
`reduceOnly`, хотя черновик (`BuildableOrderDraftBase`) его несёт, а тело
`POST /orders` принимает. `useOrderSubmission` берёт черновик целиком — и
`reduceOnly` сегодня, и `postOnly` после релиза 0.44.0 (задача 10), — поэтому
подача в форме становится одна на все три вида ордера вместо трёх. Обёртка
`useMutation` вокруг возвращённой функции — это применение TanStack Query, а не
своя доменная логика: сам корпус подачи (резерв nonce, подпись, ретрай с
переподписью) остаётся в SDK.

**Вложенность инвертируется.** Сейчас `TurnkeyProviderWrapper` монтируется
*внутри* `LiqProvider`. С `sessionKey` провайдер сам зовёт
`useSessionKeyManager`, которому нужен контекст Turnkey **над** ним, — поэтому
обёртка Turnkey уезжает наружу. Оставить как есть значит получить менеджер без
контекста: сессия молча не поднимется, и подпись уйдёт в кошелёк, то есть ровно
то состояние, которое эта задача чинит.

**`poolExecution` исчезает — это исправление, а не потеря.** Местные копии
проставляли `poolExecution: true` каждому ордеру, то есть уводили его мимо
стакана прямо в пул. Черновики SDK такого поля не несут вовсе: по документации
`SubmitOrderParams` этот флаг — путь `conditional-svc`, который так исполняет
отдыхающую лимитку, когда оракул пересёк её цену без встречного ордера. Терминал,
получивший в Ф1b стакан, не должен посылать ордера мимо него: рыночный всё равно
доходит до пула через пуловый филл движка, а лимитка ложится в книгу и
исполняется пулом через `conditional-svc`. Разница видна на проводе — её и
фиксирует шаг 1.

- [ ] **Шаг 1: провалить e2e на теле ордера**

В `e2e/tier1/07-order-submit.spec.ts` дописать спеку рядом с существующими,
переиспользуя её хелперы монтирования и подачи (не заводить своих) и уже
имеющийся `world.submittedOrders` из `e2e/support/mockGateway.ts`:

```ts
test("рыночный ордер не уводится мимо стакана", async ({ page }) => {
  const world = await mountTerminal(page);
  await submitMarketOrder(page, { size: "0.1" });
  await expect.poll(() => world.submittedOrders.length).toBe(1);
  expect(world.submittedOrders[0]).not.toHaveProperty("poolExecution");
});
```

- [ ] **Шаг 2: прогнать — должно упасть**

```bash
cd /Users/alex/Work/perps/terminal && pnpm test:e2e e2e/tier1/07-order-submit.spec.ts
```

Ожидание: FAIL — в теле стоит `poolExecution: true`.

- [ ] **Шаг 3: инвертировать провайдеры**

В `src/providers/LiqSetup.tsx` заменить хвост функции:

```tsx
  // Session keys (1-click trading) are flag-gated. `LiqProvider sessionKey`
  // publishes the active session signer, and the `useSessionKeyManager` it
  // calls needs the Turnkey context ABOVE it — hence the wrapper on the
  // outside. With the flag off no wrapper is rendered and no session config is
  // passed, so every order signs through the wallet exactly as before.
  const { enabled, orgId, authProxyUrl, authProxyConfigId } = env.turnkey;
  const provider = (
    <LiqProvider
      client={liqClient}
      onchain={liqOnchain}
      sessionKey={enabled && orgId ? env.turnkey : undefined}
    >
      {children}
    </LiqProvider>
  );

  if (!enabled || !orgId) return provider;

  return (
    <TurnkeyProviderWrapper
      orgId={orgId}
      authProxyUrl={authProxyUrl}
      authProxyConfigId={authProxyConfigId}
      walletConnectProjectId={env.walletConnectId || undefined}
      chainIds={[String(env.chainId)]}
      appName="Liq"
      // Must be the ORIGIN THIS BUILD IS SERVED FROM, not a fixed liq.cx:
      // it becomes WalletConnect's `appMetadata.url`, which the wallet shows
      // in its approval sheet. Hardcoding liq.cx made every preview/staging
      // deploy claim to be liq.cx — WalletConnect warns about the mismatch,
      // and to a user it reads like a phishing page.
      appUrl={window.location.origin}
    >
      {provider}
    </TurnkeyProviderWrapper>
  );
```

- [ ] **Шаг 4: одна подача вместо трёх**

В `src/features/trade/TradeForm.tsx` удалить три импорта местных копий и завести
корпус SDK:

```ts
import type { OrderDraft } from "@liq/sdk";
import { useOrderSubmission } from "@liq/react";
import { useMutation } from "@tanstack/react-query";
```

```ts
  const submitOrder = useOrderSubmission();
  const submit = useMutation({ mutationFn: submitOrder });
```

Заменить `submitMarket` / `limit` / `conditional` на `submit` во всей форме:

```ts
  const pending = submit.isPending;
  const error = submit.error;
```

Тело функции подачи — те же три ветви, но собирают черновик:

```ts
    if (tab === "Market") {
      submit.mutate(
        {
          kind: "market",
          accountId,
          marketId,
          sizeDelta,
          side,
          acceptablePrice: acceptablePrice(markPrice, side, SLIPPAGE_BPS),
        },
        { onSuccess },
      );
      return;
    }

    const price = parsedTabPrice();
    if (price <= 0n) return;

    if (tab === "Limit") {
      submit.mutate(
        { kind: "limit", accountId, marketId, sizeDelta, side, limitPrice: price },
        { onSuccess },
      );
    } else {
      submit.mutate(
        {
          kind: "conditional",
          accountId,
          marketId,
          sizeDelta,
          side,
          orderType: tab === "Stop" ? "STOP_MARKET" : "TAKE_PROFIT_MARKET",
          triggerPrice: price,
          triggerAbove,
        },
        { onSuccess },
      );
    }
```

У лимитного черновика `acceptablePrice` нет вовсе: подписанное сообщение
приравнивает его к лимитной цене — прежнее `acceptablePrice: price` было
повтором, который SDK всё равно игнорировал.

В `submitAttachedTpSl` заменить `conditional.mutate({...})` на

```ts
      submit.mutate({
        kind: "conditional",
        accountId,
        marketId,
        sizeDelta: closeDelta,
        side: closeSide,
        orderType,
        triggerPrice,
        triggerAbove: above,
        // Reduce-only: an attached TP/SL must only close the entry position. If
        // it fires after the position is already gone, the matching engine
        // rejects it instead of opening an unintended opposite position.
        reduceOnly: true,
      } satisfies OrderDraft);
```

Затем удалить копии:

```bash
rm -r src/features/trade/mutations
```

- [ ] **Шаг 5: прогнать e2e и гейт**

```bash
pnpm test:e2e e2e/tier1/07-order-submit.spec.ts
pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm test:e2e && pnpm build
```

Ожидание: новая спека PASS, остальные 143 — без регрессий. Особое внимание
`16-session-keys.spec.ts`: подпись переехала на другой шов, и если сессионный
ключ перестал подписывать, ломается именно она.

- [ ] **Шаг 6: коммит**

```bash
git add -A src/providers/LiqSetup.tsx src/features/trade e2e/tier1/07-order-submit.spec.ts
git commit -m "refactor(trade): подача — корпус SDK, а не три местные копии"
```

---

### Задача 3: `orderMath` терминала удаляется, счёт ведёт `@liq/core`

**Файлы:**
- Удалить: `src/features/trade/orderMath.ts`,
  `src/features/trade/__tests__/orderMath.test.ts`
- Изменить: `src/features/trade/useOrderSizing.ts`, `src/features/trade/TradeForm.tsx`

**Интерфейсы:**
- Потребляет из `@liq/core` (через `@liq/sdk`): `sizeDelta(size, side)`,
  `acceptablePrice(mark, side, slippageBps)`, `sizeFromLeverage({availableUsd,
  leverage, markPrice})`, `pctToSize(pct, maxSize)`, `sizeToPct(size, maxSize)`,
  `usdToSize(usd, markPrice)`, `sizeToUsd(size, markPrice)`,
  `marginCost(notional, leverage)`, `validateOrder(input): OrderVerdict`,
  `describeRejection(reason): string | undefined`.
- Отдаёт: `OrderSizing.validation` меняет тип с местного
  `OrderValidation {ok, reason?: string, warn?: string}` на
  `OrderVerdict {ok, reason: OrderRejection | null, warn: OrderWarning | null}`.
  Задачи 8 и 9 читают именно `OrderVerdict`.

`src/features/trade/orderMath.ts` — посимвольная копия модуля, который в
`@liq/core` 0.43.0 уже есть; держать её значит нарушать главное правило арки.
Соответствия имён, где они разошлись:

| Местное | В `@liq/core` |
| --- | --- |
| `computeSizeDelta(size, side)` | `sizeDelta(size, side)` |
| `maxSizeQty({availableUsd, leverage, markPrice})` | `sizeFromLeverage({availableUsd, leverage, markPrice})` |
| `validateOrder` → `{ok, reason?: string}` | `validateOrder` → `OrderVerdict`, слова даёт `describeRejection` |

Остальные (`acceptablePrice`, `pctToSize`, `sizeToPct`, `usdToSize`, `sizeToUsd`,
`marginCost`) совпадают именем и сигнатурой.

Тест `__tests__/orderMath.test.ts` уходит вместе с модулем: он проверял чужой
код, который теперь проверяет свой репозиторий. Поведение стыка накрывают
тесты `useOrderSizing` (они остаются) и задача 4.

- [ ] **Шаг 1: убедиться, что тесты `useOrderSizing` сейчас зелёные**

```bash
cd /Users/alex/Work/perps/terminal && pnpm test -- useOrderSizing
```

Ожидание: PASS. Это опорная точка — после переезда они обязаны остаться
зелёными без правок ожиданий, кроме поля `validation` (шаг 3).

- [ ] **Шаг 2: удалить модуль и его тест**

```bash
rm src/features/trade/orderMath.ts src/features/trade/__tests__/orderMath.test.ts
```

- [ ] **Шаг 3: перевести `useOrderSizing.ts` на SDK**

Заменить блок импортов (строки 1–25) на:

```ts
import {
  acceptablePrice,
  calcRequiredMaintenanceMargin,
  describeRejection,
  draftLiquidationPrice,
  marginCost,
  Margin,
  type OrderVerdict,
  pctToSize,
  Price,
  Qty,
  Side,
  sizeDelta as signedSize,
  sizeFromLeverage,
  sizeToPct,
  sizeToUsd,
  Usd,
  usdToSize,
  validateOrder,
} from "@liq/sdk";
import { useMarketsFullRestQuery } from "@liq/react";
import { useState } from "react";

import { parseWadLoose, wadToFixed } from "../../lib/format";
import type { MarketSummary } from "../market/useSelectedMarket";
```

`acceptablePrice` здесь не используется — он нужен `TradeForm` (шаг 4); из этого
файла его не импортировать.

В типе `OrderSizing` заменить поле:

```ts
  validation: OrderVerdict;
```

В теле хука — три вызова:

```ts
  const maxSize = sizeFromLeverage({
    availableUsd: Usd(available),
    leverage,
    markPrice: Price(markPrice),
  });
```

```ts
  const sizeDelta = signedSize(Qty(sizeQty), side);
```

```ts
  const validation = validateOrder({
    markPrice,
    sizeQty: Qty(sizeQty),
    minSize: Qty(minSize),
    leverage,
    maxLeverage,
    available: Margin(available),
    marginCost: Margin(margin),
  });
```

и в `setLeverage`:

```ts
      const nextMax = sizeFromLeverage({
        availableUsd: Usd(available),
        leverage: l,
        markPrice: Price(markPrice),
      });
```

Прочие вызовы (`pctToSize`, `sizeToPct`, `usdToSize`, `sizeToUsd`, `marginCost`)
меняют только источник импорта; там, где `tsc` потребует бренд, оборачивать
конструктором бренда (`Qty(x)`, `Usd(x)`, `Price(x)`, `Margin(x)`) — **никогда**
`as never` и `as unknown as`.

- [ ] **Шаг 4: перевести `TradeForm.tsx`**

Удалить импорт `import { acceptablePrice } from "./orderMath";` и добавить
`acceptablePrice` в существующий импорт из `@liq/sdk`:

```ts
import { acceptablePrice, Bps, Price, Side } from "@liq/sdk";
```

Вызов принимает бренды:

```ts
          acceptablePrice: acceptablePrice(Price(markPrice), side, Bps(SLIPPAGE_BPS)),
```

Ярлык кнопки берёт слова из SDK:

```ts
  const fallbackLabel = long ? "Buy / Long" : "Sell / Short";
  const submitLabel = !sizing.validation.ok
    ? (describeRejection(sizing.validation.reason) ?? fallbackLabel)
    : pending
      ? "Submitting…"
      : fallbackLabel;
```

`describeRejection` даёт ровно те же слова (`Min 0.001`, `Max 25×`), что писала
местная копия, и молчит на `not-ready` — поэтому пустой тикет сохраняет ярлык по
умолчанию, а не обвиняет пользователя в недописанном ордере.

- [ ] **Шаг 5: тесты `useOrderSizing` — обновить только поле `validation`**

Там, где тест читал `result.current.validation.reason` строкой, читать вердикт:

```ts
expect(result.current.validation.ok).toBe(false);
expect(result.current.validation.reason).toEqual({
  kind: "below-min-size",
  minSize: 10n ** 15n,
});
```

Ожиданий про числа (размер, маржа, процент, цена ликвидации) не трогать: если
хоть одно поехало, значит переезд изменил счёт, и это дефект переезда, а не
устаревшее ожидание.

- [ ] **Шаг 6: гейт**

```bash
pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build
grep -rn "orderMath" src/ e2e/ || echo "ссылок не осталось"
```

- [ ] **Шаг 7: коммит**

```bash
git add -A src/features/trade
git commit -m "refactor(trade): счёт ордера ведёт @liq/core, копия в терминале удалена"
```

---

### Задача 4: `ticketSummary` — пара long/short одной чистой функцией

**Файлы:**
- Создать: `src/features/trade/ticketSummary.ts`
- Тест: `src/features/trade/__tests__/ticketSummary.test.ts`
- Изменить: `src/features/trade/useOrderSizing.ts`

**Интерфейсы:**
- Потребляет: `sizeToUsd`, `marginCost`, `sizeDelta`, `calcRequiredMaintenanceMargin`,
  `draftLiquidationPrice`, `Side` из `@liq/sdk`.
- Отдаёт: `ticketSummary(input): TicketSummary` и типы `TicketSummary` / `TicketSide`;
  `OrderSizing` получает поле `summary: TicketSummary`. Их читает задача 9.

Макет показывает сводку **парой**: `Order qty.`, `Order value` и `Cost` — одно и
то же число, покрашенное зелёным для лонга и красным для шорта, а `Liq. Price` —
два **разных** числа нейтральным цветом. Тикет считает оба исхода сразу, а не
переключает пару по выбранной стороне.

Функция чистая и живёт отдельно от хука: пара сторон — вся арифметика, которую
эта фаза добавляет, и проверять её через рендер значит проверять раскладку
вместо счёта. Своего домена она не заводит — только зовёт `@liq/core` дважды,
по разу на сторону.

- [ ] **Шаг 1: написать падающий тест**

`src/features/trade/__tests__/ticketSummary.test.ts`:

```ts
import { Margin, Price, Qty, Usd } from "@liq/sdk";
import { describe, expect, it } from "vitest";

import { ticketSummary } from "../ticketSummary";

const MARK = Price.parse("2446.07");
const ONE = Qty.parse("1");
/** Поддерживающая доля 1% в WAD — как её отдаёт `maintenanceMarginBps` рынка. */
const MMF = 10n ** 16n;

describe("ticketSummary", () => {
  it("количество, объём и стоимость от стороны не зависят", () => {
    const s = ticketSummary({ sizeQty: ONE, markPrice: MARK, leverage: 10, mmfWad: MMF });
    expect(s.qty).toBe(ONE);
    expect(s.value).toBe(Usd.parse("2446.07"));
    expect(s.cost).toBe(Margin.parse("244.607"));
    expect(s.long.sizeDelta).toBe(ONE);
    expect(s.short.sizeDelta).toBe(-ONE);
  });

  it("ликвидация у лонга ниже марка, у шорта выше", () => {
    const s = ticketSummary({ sizeQty: ONE, markPrice: MARK, leverage: 10, mmfWad: MMF });
    expect(s.long.liqPrice).not.toBeNull();
    expect(s.short.liqPrice).not.toBeNull();
    expect(s.long.liqPrice!).toBeLessThan(MARK);
    expect(s.short.liqPrice!).toBeGreaterThan(MARK);
  });

  it("без поддерживающей доли уровня нет, но остальное считается", () => {
    const s = ticketSummary({ sizeQty: ONE, markPrice: MARK, leverage: 10, mmfWad: undefined });
    expect(s.long.liqPrice).toBeNull();
    expect(s.short.liqPrice).toBeNull();
    expect(s.value).toBe(Usd.parse("2446.07"));
  });

  it("пустой размер не выдумывает чисел", () => {
    const s = ticketSummary({ sizeQty: Qty(0n), markPrice: MARK, leverage: 10, mmfWad: MMF });
    expect(s.value).toBe(0n);
    expect(s.cost).toBe(0n);
    expect(s.long.liqPrice).toBeNull();
    expect(s.short.liqPrice).toBeNull();
  });

  it("без марка объём не считается", () => {
    const s = ticketSummary({ sizeQty: ONE, markPrice: Price(0n), leverage: 10, mmfWad: MMF });
    expect(s.value).toBe(0n);
    expect(s.cost).toBe(0n);
  });
});
```

- [ ] **Шаг 2: прогнать — должно упасть**

```bash
cd /Users/alex/Work/perps/terminal && pnpm test -- ticketSummary
```

Ожидание: FAIL — `Failed to resolve import "../ticketSummary"`.

- [ ] **Шаг 3: написать модуль**

`src/features/trade/ticketSummary.ts`:

```ts
import {
  calcRequiredMaintenanceMargin,
  draftLiquidationPrice,
  Margin,
  marginCost,
  Price,
  Qty,
  Side,
  sizeDelta,
  sizeToUsd,
  Usd,
} from "@liq/sdk";

/** Одна сторона предполагаемого ордера. */
export interface TicketSide {
  /** Знаковый размер: положительный — лонг, отрицательный — шорт. */
  sizeDelta: Qty;
  /**
   * Оценка ликвидации черновика, или `null`.
   *
   * @remarks `null` — «уровня нет», а не «уровень в нуле»: ноль здесь читался
   * бы как измеренная цена. Приходит из `draftLiquidationPrice`, который
   * отвечает на вопрос тикета «куда мне нельзя», а не на вопрос аккаунта
   * «когда меня ликвидируют».
   */
  liqPrice: Price | null;
}

/** Сводка тикета: общая часть плюс по стороне на каждый исход. */
export interface TicketSummary {
  /** Величина без знака — одна на обе стороны. */
  qty: Qty;
  /** Объём в USD по марку. */
  value: Usd;
  /** Маржа, которую ордер стоит при выбранном плече. */
  cost: Margin;
  long: TicketSide;
  short: TicketSide;
}

function sideOf(
  side: Side,
  sizeQty: Qty,
  markPrice: Price,
  margin: Margin,
  mmfWad: bigint | undefined,
): TicketSide {
  const delta = sizeDelta(sizeQty, side);
  if (mmfWad === undefined || margin <= 0n || markPrice <= 0n || delta === 0n) {
    return { sizeDelta: delta, liqPrice: null };
  }
  const requirement = calcRequiredMaintenanceMargin(delta, markPrice, mmfWad);
  return {
    sizeDelta: delta,
    liqPrice:
      draftLiquidationPrice({ size: delta, mark: markPrice, margin, requirement }) ?? null,
  };
}

/**
 * Обе стороны одного черновика разом.
 *
 * @remarks
 * Тикет по макету показывает лонг и шорт рядом, а не по выбранной стороне,
 * поэтому обе оценки ликвидации считаются всегда — и различаются: относительно
 * входа уровень асимметричен.
 *
 * @param mmfWad - поддерживающая доля маржи в WAD; `undefined`, когда рынок её
 *   не отдал. Тогда уровня нет ни у одной стороны, но количество, объём и
 *   стоимость остаются посчитанными: отсутствие одной величины не повод
 *   стереть остальные.
 */
export function ticketSummary(input: {
  sizeQty: Qty;
  markPrice: Price;
  leverage: number;
  mmfWad: bigint | undefined;
}): TicketSummary {
  const { sizeQty, markPrice, leverage, mmfWad } = input;
  const value = markPrice > 0n ? sizeToUsd(sizeQty, markPrice) : Usd(0n);
  const cost = marginCost(value, leverage);
  return {
    qty: sizeQty,
    value,
    cost,
    long: sideOf(Side.BUY, sizeQty, markPrice, cost, mmfWad),
    short: sideOf(Side.SELL, sizeQty, markPrice, cost, mmfWad),
  };
}
```

- [ ] **Шаг 4: прогнать — должно пройти**

```bash
pnpm test -- ticketSummary
```

Ожидание: 5 passed.

- [ ] **Шаг 5: доказать тесты мутацией**

Внести по одной правке, каждый раз прогоняя `pnpm test -- ticketSummary`, и
каждый раз возвращая файл (`git checkout -- src/features/trade/ticketSummary.ts`):

1. В `sideOf` заменить `sizeDelta(sizeQty, side)` на `sizeDelta(sizeQty, Side.BUY)`
   → падает «ликвидация у лонга ниже марка, у шорта выше».
2. Убрать из гварда `mmfWad === undefined` → падает «без поддерживающей доли».
3. Заменить `markPrice > 0n ? … : Usd(0n)` на безусловный `sizeToUsd(...)`
   → падает «без марка объём не считается».

Если хоть одна мутация оставляет тесты зелёными — тест ничего не проверяет,
и чинить нужно тест, а не мутацию.

- [ ] **Шаг 6: переключить `useOrderSizing` на `ticketSummary`**

Удалить из `useOrderSizing.ts` функцию `estimateLiqPrice` целиком (её работу
теперь делает `sideOf`) и заменить блок расчёта:

```ts
  const sizeQty = parseSizeInput(sizeStr, unit, markPrice);
  const maxSize = sizeFromLeverage({
    availableUsd: Usd(available),
    leverage,
    markPrice: Price(markPrice),
  });
  const summary = ticketSummary({
    sizeQty: Qty(sizeQty),
    markPrice: Price(markPrice),
    leverage,
    mmfWad,
  });
  const notional = summary.value;
  const margin = summary.cost;
  const side_ = side === Side.BUY ? summary.long : summary.short;
  const sizeDelta = side_.sizeDelta;
  const liqPrice = side_.liqPrice;
```

Добавить `summary` в тип `OrderSizing` (`summary: TicketSummary`) и в возвращаемый
объект. Импорты `calcRequiredMaintenanceMargin`, `draftLiquidationPrice`,
`marginCost`, `sizeToUsd`, `Margin`, `sizeDelta as signedSize` из
`useOrderSizing.ts` уходят — их зовёт `ticketSummary`.

- [ ] **Шаг 7: гейт**

```bash
pnpm test && pnpm typecheck && node_modules/.bin/eslint . && pnpm build
```

Тесты `useOrderSizing` должны остаться зелёными **без правки числовых
ожиданий**: `ticketSummary` считает ровно то же, что считал хук.

- [ ] **Шаг 8: коммит**

```bash
git add src/features/trade/ticketSummary.ts src/features/trade/__tests__/ticketSummary.test.ts src/features/trade/useOrderSizing.ts
git commit -m "feat(trade): сводка тикета считает обе стороны сразу"
```

---

### Задача 5: шапка тикета — плечо списком, `Available`, кнопка пополнения

**Файлы:**
- Создать: `src/features/trade/TicketHeader.tsx`, `src/features/trade/leverageSteps.ts`
- Изменить: `src/features/trade/TradeForm.tsx`
- Тест: `e2e/tier1/04-trade-form.spec.ts` (правка локатора плеча)

**Интерфейсы:**
- Потребляет: `Select*` (задача 1), `OrderSizing.leverage` / `setLeverage` (задача 3),
  `DepositDialog` из `../account/DepositDialog` (пропсы `{open, onClose}`).
- Отдаёт: `<TicketHeader leverage maxLeverage onLeverage available quoteSymbol />`;
  testid `leverage-select` (заменяет `leverage-slider`), `leverage-value`
  (сохраняется), `ticket-available` (новый), `ticket-deposit-button` (новый).
  `available-margin` **не трогать**: он живёт в `MarketHeader.tsx` и остаётся
  там — второй элемент с тем же testid дал бы strict-mode violation в Playwright
  на каждом `getByTestId("available-margin")`.

Макет ставит в шапку колонки две пилюли — `Cross ▾` и `10x ▾`. Первая не
рисуется: режима маржи в API нет, спека объявила его вне охвата, а пилюля,
которая ничего не переключает, врёт про возможности площадки. Вторая заменяет
нынешний сырой `<input type="range">` для плеча.

Лестница значений: `1, 2, 3, 5, 10, 15, 20, 25`, отфильтрованная по
`market.maxLeverage`, плюс сам `maxLeverage`, если его в лестнице нет — иначе
рынок с максимумом 40× не даст выбрать своё же максимальное плечо.

- [ ] **Шаг 1: написать падающий тест лестницы**

`src/features/trade/__tests__/leverageSteps.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { leverageSteps } from "../leverageSteps";

describe("leverageSteps", () => {
  it("режет лестницу по максимуму рынка", () => {
    expect(leverageSteps(10)).toEqual([1, 2, 3, 5, 10]);
  });

  it("дотягивает максимум рынка, которого нет в лестнице", () => {
    expect(leverageSteps(40)).toEqual([1, 2, 3, 5, 10, 15, 20, 25, 40]);
  });

  it("максимум, совпавший со ступенью, не удваивается", () => {
    expect(leverageSteps(25)).toEqual([1, 2, 3, 5, 10, 15, 20, 25]);
  });

  it("бессмысленный максимум оставляет хотя бы единицу", () => {
    expect(leverageSteps(0)).toEqual([1]);
  });
});
```

- [ ] **Шаг 2: прогнать — должно упасть**

```bash
pnpm test -- leverageSteps
```

Ожидание: FAIL — модуля нет.

- [ ] **Шаг 3: написать компонент**

Сперва чистая часть — `src/features/trade/leverageSteps.ts`:

```ts
const LADDER = [1, 2, 3, 5, 10, 15, 20, 25];

/**
 * Значения плеча, которые рынок допускает.
 *
 * @remarks Максимум рынка добавляется отдельно, если в лестницу он не попал:
 * иначе рынок с максимумом 40× не даёт выбрать собственный максимум. Пустая
 * лестница (бессмысленный максимум) вырождается в единицу, а не в пустой
 * список: список без единого значения не даёт выбрать вообще ничего.
 */
export function leverageSteps(maxLeverage: number): number[] {
  const capped = LADDER.filter((l) => l <= maxLeverage);
  if (capped.length === 0) return [1];
  return capped.some((l) => l === maxLeverage) ? capped : [...capped, maxLeverage];
}
```

Затем `src/features/trade/TicketHeader.tsx`:

```tsx
import { useState } from "react";
import { PlusCircle } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtUsd } from "../../lib/format";
import { DepositDialog } from "../account/DepositDialog";
import { leverageSteps } from "./leverageSteps";

export function TicketHeader({
  leverage,
  maxLeverage,
  onLeverage,
  available,
  quoteSymbol,
}: {
  leverage: number;
  maxLeverage: number;
  onLeverage: (l: number) => void;
  /** Доступная маржа, 18 знаков; `null` — ответа ещё нет. */
  available: bigint | null;
  quoteSymbol: string;
}) {
  const [depositOpen, setDepositOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <Select
          value={String(leverage)}
          onValueChange={(v) => onLeverage(Number(v))}
        >
          <SelectTrigger
            className="h-7 w-auto gap-1 rounded-full bg-surface-2 px-3 text-[11px]"
            data-testid="leverage-select"
          >
            <SelectValue data-testid="leverage-value">{leverage}x</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {leverageSteps(maxLeverage).map((l) => (
              <SelectItem key={l} value={String(l)} data-testid={`leverage-option-${l}`}>
                {l}x
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted">Available</span>
        <span className="flex items-center gap-2">
          <span className="text-text" data-testid="ticket-available">
            {available === null ? "—" : fmtUsd(available)}
          </span>
          <span className="text-muted">{quoteSymbol}</span>
          <button
            type="button"
            aria-label="Deposit"
            onClick={() => setDepositOpen(true)}
            className="text-long hover:opacity-80"
            data-testid="ticket-deposit-button"
          >
            <PlusCircle size={14} />
          </button>
        </span>
      </div>

      <DepositDialog open={depositOpen} onClose={() => setDepositOpen(false)} />
    </div>
  );
}
```

`available === null` рисует прочерк, а не `0.00`: пока ответа о марже нет, ноль
читался бы как измеренный пустой счёт. Ноль показывается только тогда, когда он
действительно пришёл.

- [ ] **Шаг 4: прогнать тест лестницы**

```bash
pnpm test -- leverageSteps
```

Ожидание: 4 passed.

- [ ] **Шаг 5: вставить шапку в форму**

В `TradeForm.tsx` удалить блок сырого слайдера плеча (`<div>` с подписью
`Leverage`, `leverage-value` и `<input type="range" data-testid="leverage-slider">`);
на его место, первым блоком карточки — до ряда вкладок:

```tsx
      <TicketHeader
        leverage={sizing.leverage}
        maxLeverage={maxLev}
        onLeverage={sizing.setLeverage}
        available={margins ? margins.available : null}
        quoteSymbol="USD"
      />
```

- [ ] **Шаг 6: обновить e2e, ходившие по слайдеру плеча**

```bash
grep -rn "leverage-slider" e2e/
```

Каждое вхождение перевести на список: вместо перетаскивания ползунка —

```ts
await page.getByTestId("leverage-select").click();
await page.getByTestId("leverage-option-10").click();
await expect(page.getByTestId("leverage-value")).toHaveText("10x");
```

- [ ] **Шаг 7: гейт**

```bash
pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm test:e2e && pnpm build
```

- [ ] **Шаг 8: коммит**

```bash
git add src/features/trade e2e
git commit -m "feat(trade): шапка тикета — плечо списком, доступная маржа, пополнение"
```

---

### Задача 6: поля цены и количества по макету

**Файлы:**
- Создать: `src/features/trade/OrderPriceField.tsx`,
  `src/features/trade/QuantityField.tsx`, `src/features/trade/useBookMid.ts`
- Удалить: `src/features/trade/SizeField.tsx`
- Изменить: `src/features/trade/useOrderSizing.ts`, `src/features/trade/TradeForm.tsx`

**Интерфейсы:**
- Потребляет: `Select*` (задача 1), `DecimalInput`, `useOrderbook` из `@liq/react`.
- Отдаёт: `OrderSizing.setUnit(u: SizeUnit)` **вместо** `toggleUnit()`;
  компоненты `<OrderPriceField>` и `<QuantityField>`; testid `mid-price-button`
  (новый), `size-unit-select` (заменяет `size-unit-toggle`), `size-quote-value`
  (новый), `limit-price-input` и `size-input` — сохраняются.

Макет даёт полю цены текстовую кнопку `MID` в правом верхнем углу, а полю
количества — селектор единиц вместо кнопки-переключателя и строку пересчёта
`≈ N` под полем, прижатую вправо.

Пересчёт берётся от **марка**, а не от введённой цены: в макете `1 ETH` при
цене ордера `2446.07` показан как `≈ 2,440.00`, что равно Mark Price из шапки.
Строка отвечает на «сколько это стоит сейчас», а не «сколько я предлагаю»; с
маркой это согласуется и с `sizeToUsd`, от которого считает весь остальной тикет.

`MID` берёт середину из того же шва, что и панель стакана. Середина считается от
**сырых** цен до группировки, поэтому шаг группировки на неё не влияет и тикету
не нужно знать, какой шаг выбрал пользователь в панели. Когда середины нет
(`mid === null` — книга пуста и марка нет), кнопка неактивна: подставлять ноль
в поле цены значит выдать отсутствие цены за цену.

- [ ] **Шаг 1: написать хук середины**

`src/features/trade/useBookMid.ts`:

```ts
import { Price } from "@liq/sdk";
import { useOrderbook } from "@liq/react";

import { useSelectedMarket } from "../market/useSelectedMarket";
import { useBookTick } from "../orderbook/useBookTick";
import { useMarkPrice } from "./useMarkPrice";

/**
 * Середина спреда для кнопки `MID`.
 *
 * @remarks
 * Считается от сырых цен до группировки, поэтому шаг здесь любой валидный — он
 * влияет только на строки, которых тикету не нужно (`depth: 1`). `null` значит
 * «цены нет»: книга пуста и марка не пришла.
 */
export function useBookMid(): bigint | null {
  const { marketId } = useSelectedMarket();
  const markPrice = useMarkPrice();
  const { tick } = useBookTick(markPrice);
  const { book } = useOrderbook(marketId ?? null, {
    tick: Price(tick),
    depth: 1,
    markPrice: markPrice === 0n ? undefined : Price(markPrice),
  });
  return book.mid;
}
```

- [ ] **Шаг 2: написать поле цены**

`src/features/trade/OrderPriceField.tsx`:

```tsx
import { DecimalInput } from "../../components/ui/DecimalInput";

export function OrderPriceField({
  value,
  onChange,
  onMid,
  midDisabled,
  maxDecimals,
}: {
  value: string;
  onChange: (v: string) => void;
  onMid: () => void;
  /** Середины нет — подставлять нечего. */
  midDisabled: boolean;
  maxDecimals: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[10px] uppercase text-muted">Order price</label>
        <button
          type="button"
          onClick={onMid}
          disabled={midDisabled}
          className="text-[10px] font-medium text-accent disabled:opacity-40"
          data-testid="mid-price-button"
        >
          MID
        </button>
      </div>
      <DecimalInput
        value={value}
        onValueChange={onChange}
        maxDecimals={maxDecimals}
        placeholder="0.00"
        data-testid="limit-price-input"
      />
    </div>
  );
}
```

- [ ] **Шаг 3: написать поле количества**

`src/features/trade/QuantityField.tsx`:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DecimalInput } from "../../components/ui/DecimalInput";
import { fmtUsd } from "../../lib/format";
import type { SizeUnit } from "./useOrderSizing";

/**
 * Количество ордера: значение, выбор единиц и пересчёт под полем.
 *
 * @remarks Пересчёт считается от МАРКА, а не от введённой цены ордера: строка
 * отвечает на «сколько это стоит сейчас». Пусто, когда марка нет — числа,
 * которого не из чего получить, здесь быть не должно.
 */
export function QuantityField({
  value,
  onChange,
  unit,
  onUnit,
  baseSymbol,
  quoteSymbol,
  notional,
  invalid,
  unitDisabled,
}: {
  value: string;
  onChange: (v: string) => void;
  unit: SizeUnit;
  onUnit: (u: SizeUnit) => void;
  baseSymbol: string;
  quoteSymbol: string;
  /** Объём по марку, 18 знаков; `0n` — пересчитывать нечем. */
  notional: bigint;
  invalid?: boolean;
  /** Нет марка — конвертировать между единицами нечем. */
  unitDisabled?: boolean;
}) {
  const base = baseSymbol || "BASE";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[10px] uppercase text-muted">Quantity</label>
        <Select
          value={unit}
          onValueChange={(v) => onUnit(v as SizeUnit)}
          disabled={unitDisabled}
        >
          <SelectTrigger
            className="h-6 w-auto gap-1 border-0 bg-transparent px-1 text-[10px] text-muted"
            data-testid="size-unit-select"
          >
            <SelectValue>{unit === "base" ? base : quoteSymbol}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="base" data-testid="size-unit-base">{base}</SelectItem>
            <SelectItem value="usd" data-testid="size-unit-usd">{quoteSymbol}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DecimalInput
        value={value}
        onValueChange={onChange}
        maxDecimals={unit === "base" ? 8 : 2}
        invalid={invalid}
        placeholder="0.00"
        data-testid="size-input"
      />
      <div className="mt-1 text-right text-[10px] text-muted" data-testid="size-quote-value">
        {notional > 0n ? `≈ ${fmtUsd(notional)} ${quoteSymbol}` : ""}
      </div>
    </div>
  );
}
```

- [ ] **Шаг 4: заменить `toggleUnit` на `setUnit`**

В `useOrderSizing.ts` переименовать сеттер состояния (`const [unit, setUnitRaw]`)
и заменить функцию:

```ts
  function setUnit(next: SizeUnit) {
    if (next === unit) return;
    // Без марка нет пересчёта base⇄USD: смена единиц отформатировала бы в ""
    // и молча стёрла введённый размер. До прихода цены — ничего не делаем.
    if (markPrice <= 0n) return;
    setSizeStrRaw(fmtForUnit(sizeQty, next));
    setUnitRaw(next);
  }
```

В типе `OrderSizing` и в возвращаемом объекте `toggleUnit: () => void` меняется
на `setUnit: (u: SizeUnit) => void`. В тестах `useOrderSizing` вызовы
`result.current.toggleUnit()` заменить на `result.current.setUnit("usd")` /
`setUnit("base")`; ожидания не трогать — поведение то же.

- [ ] **Шаг 5: собрать в форме**

В `TradeForm.tsx`: удалить импорт и использование `SizeField`, добавить
`OrderPriceField`, `QuantityField`, `useBookMid`; блок лимитной цены заменить на

```tsx
      {tab === "Limit" && (
        <OrderPriceField
          value={limitPrice}
          onChange={setLimitPrice}
          onMid={() => {
            if (mid === null) return;
            setLimitPrice(sanitizeDecimal(Price.fmt(Price(mid)), LIMIT_PRICE_DECIMALS));
          }}
          midDisabled={mid === null}
          maxDecimals={LIMIT_PRICE_DECIMALS}
        />
      )}
```

где `const mid = useBookMid();` рядом с прочими хуками, а `SizeField` — на

```tsx
      <QuantityField
        value={sizing.sizeStr}
        onChange={sizing.setSizeStr}
        unit={sizing.unit}
        onUnit={sizing.setUnit}
        baseSymbol={sizing.baseSymbol}
        quoteSymbol="USD"
        notional={sizing.notional}
        invalid={!sizing.validation.ok && sizing.validation.reason?.kind !== "not-ready"}
        unitDisabled={markPrice === 0n}
      />
```

`not-ready` не красит поле: у недописанного ордера нет ошибки, о которой стоит
сообщать. Затем `rm src/features/trade/SizeField.tsx`.

- [ ] **Шаг 6: перевести e2e с прежних локаторов**

```bash
grep -rn "size-unit-toggle\|size-max-button" e2e/
```

`size-unit-toggle` → выбор через список:

```ts
await page.getByTestId("size-unit-select").click();
await page.getByTestId("size-unit-usd").click();
```

`size-max-button` больше не существует как часть поля — 100% даёт слайдер
(задача 7), а быстрых кнопок-долей макет не показывает вовсе. Спеки, которые
нажимали Max, переводятся на клавиатуру ползунка:

```ts
await page.getByTestId("size-pct-slider").getByRole("slider").focus();
await page.keyboard.press("End");
await expect(page.getByTestId("size-pct-value")).toHaveText("100%");
```

- [ ] **Шаг 7: гейт**

```bash
pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm test:e2e && pnpm build
```

- [ ] **Шаг 8: коммит**

```bash
git add -A src/features/trade e2e
git commit -m "feat(trade): поля цены и количества по макету — MID и выбор единиц"
```

---

### Задача 7: ступенчатый слайдер доли

**Файлы:**
- Создать: `src/features/trade/SizeSlider.tsx`
- Удалить: `src/features/trade/SizePercent.tsx`
- Изменить: `src/features/trade/TradeForm.tsx`
- Тест: `e2e/tier1/04-trade-form.spec.ts`

**Интерфейсы:**
- Потребляет: `Slider` (задача 1), `OrderSizing.pct` / `setPct` (задача 3).
- Отдаёт: `<SizeSlider pct onPct disabled />`; testid `size-pct-slider`
  (сохраняется, теперь на корне radix), `size-pct-value` (сохраняется).
  Testid'ы `size-pct-25` / `-50` / `-75` / `-100` **исчезают**.

Макет показывает дорожку с пятью точками (0 / 25 / 50 / 75 / 100) и ползунком —
без числовых подписей процентов и без кнопок-долей под ней. Нынешний блок —
сырой `<input type="range">` с шагом 1 плюс четыре кнопки; и то, и другое
заменяется одним radix-слайдером с шагом 25.

Значение `pct` при этом не обязано лежать на ступени: набранный руками размер
даёт любой процент, и `sizeToPct` его возвращает. Ползунок тогда стоит между
точками — это правда о введённом размере, а не сбой; шаг 25 действует на
перетаскивание и клавиатуру, а не на отображение.

- [ ] **Шаг 1: написать падающий e2e**

В `e2e/tier1/04-trade-form.spec.ts`:

```ts
test("слайдер шагает по четвертям", async ({ page }) => {
  await mountTerminal(page);
  const thumb = page.getByTestId("size-pct-slider").getByRole("slider");
  await thumb.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("size-pct-value")).toHaveText("25%");
  await page.keyboard.press("End");
  await expect(page.getByTestId("size-pct-value")).toHaveText("100%");
});
```

- [ ] **Шаг 2: прогнать — должно упасть**

```bash
pnpm test:e2e e2e/tier1/04-trade-form.spec.ts
```

Ожидание: FAIL — у сырого `<input type="range">` нет роли `slider` внутри
контейнера с этим testid, и шаг у него единичный.

- [ ] **Шаг 3: написать компонент**

`src/features/trade/SizeSlider.tsx`:

```tsx
import { Slider } from "@/components/ui/slider";

const STOPS = [0, 25, 50, 75, 100] as const;

/**
 * Доля покупательной способности — ползунок с четвертными остановками.
 *
 * @remarks Шаг 25 применяется к вводу, а не к показу: набранный руками размер
 * даёт произвольный процент, и ползунок между точками честно говорит, где он
 * стоит. Округлять его до ступени значило бы показать не тот размер, который
 * уйдёт в ордер.
 */
export function SizeSlider({
  pct,
  onPct,
  disabled,
}: {
  pct: number;
  onPct: (p: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-[10px] uppercase text-muted">
        <span>Amount</span>
        <span className="text-text" data-testid="size-pct-value">
          {Math.round(pct)}%
        </span>
      </div>
      <div className="relative" data-testid="size-pct-slider">
        <Slider
          min={0}
          max={100}
          step={25}
          value={[Math.round(pct)]}
          disabled={disabled}
          onValueChange={([v]) => onPct(v)}
          aria-label="Order size percent"
        />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2">
          {STOPS.map((s) => (
            <span
              key={s}
              style={{ left: `${s}%` }}
              className="absolute size-1 -translate-x-1/2 rounded-full bg-border"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Шаг 4: подставить в форму**

В `TradeForm.tsx` заменить импорт `SizePercent` на `SizeSlider` и блок:

```tsx
      <SizeSlider
        pct={sizing.pct}
        onPct={sizing.setPct}
        disabled={insufficientMargin || markPrice === 0n}
      />
```

```bash
rm src/features/trade/SizePercent.tsx
```

- [ ] **Шаг 5: перевести оставшиеся e2e**

```bash
grep -rn "size-pct-25\|size-pct-50\|size-pct-75\|size-pct-100" e2e/
```

Каждое вхождение — на клавиатуру ползунка (`ArrowRight` = +25 %, `End` = 100 %).

- [ ] **Шаг 6: прогнать и гейт**

```bash
pnpm test:e2e e2e/tier1/04-trade-form.spec.ts
pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm test:e2e && pnpm build
```

- [ ] **Шаг 7: коммит**

```bash
git add -A src/features/trade e2e
git commit -m "feat(trade): доля — ступенчатый слайдер radix вместо range и кнопок"
```

---

### Задача 8: флажки исполнения — Post Only, IOC, Reduce Only, TP/SL

**Файлы:**
- Создать: `src/features/trade/ExecutionFlags.tsx`
- Изменить: `src/features/trade/TradeForm.tsx`
- Тест: `e2e/tier1/22-ticket-flags.spec.ts` (создать)

**Интерфейсы:**
- Потребляет: `Checkbox`, `Tooltip*` (задача 1); мутацию `submit` (задача 2).
- Отдаёт: `<ExecutionFlags postOnly onPostOnly reduceOnly onReduceOnly tpsl
  onTpsl postOnlyAvailable />`; testid `flag-post-only`, `flag-ioc`,
  `flag-reduce-only`, `tpsl-toggle` (сохраняется, переезжает сюда).

Три флага макета обеспечены по-разному, и показывать их одинаково нельзя:

| Флаг | Чем обеспечен | Как рисуем |
| --- | --- | --- |
| Reduce Only | Подписан EIP-712, есть у черновика, принимает шлюз | Рабочий чекбокс |
| Post Only | Не подписан, но принимает шлюз и понимает движок | Рабочий чекбокс — с 0.44.0 (задача 10); до релиза хранит состояние и на провод не уходит |
| IOC | Клиенту недостижим вовсе | `disabled` + подсказка |

`IOC` показывается неактивным, а не прячется: в макете он есть, и его отсутствие
скрыло бы факт. Работающий вид у неработающего флажка был бы хуже — заказанный
`IOC` всегда был `GTC` (так и написано в `@deprecated` у `SubmitLimitOrderInput.timeInForce`),
и молчаливое исполнение по другому правилу дороже честного «пока нельзя».

`Post Only` имеет смысл только у лимитного вида — шлюз отвечает отказом на
рыночных, — поэтому на вкладках `Market`, `Stop` и `Take Profit` он тоже
неактивен.

- [ ] **Шаг 1: написать падающий e2e**

`e2e/tier1/22-ticket-flags.spec.ts` (хелперы — из `04-trade-form.spec.ts`):

```ts
import { expect, test } from "@playwright/test";

import { mountTerminal, submitMarketOrder } from "./helpers";

test.describe("флажки тикета", () => {
  test("IOC показан, но нажать нельзя", async ({ page }) => {
    await mountTerminal(page);
    await expect(page.getByTestId("flag-ioc")).toBeVisible();
    await expect(page.getByTestId("flag-ioc")).toBeDisabled();
  });

  test("Post Only недоступен на рыночной вкладке", async ({ page }) => {
    await mountTerminal(page);
    await expect(page.getByTestId("flag-post-only")).toBeDisabled();
  });

  test("Reduce Only доезжает до тела ордера", async ({ page }) => {
    const world = await mountTerminal(page);
    await page.getByTestId("flag-reduce-only").click();
    await submitMarketOrder(page, { size: "0.1" });
    await expect.poll(() => world.submittedOrders.length).toBe(1);
    expect(world.submittedOrders[0].reduceOnly).toBe(true);
  });
});
```

Если `mountTerminal` / `submitMarketOrder` не вынесены в общий модуль, а лежат
внутри `04-trade-form.spec.ts` — сперва вынести их в `e2e/tier1/helpers.ts`
одним движением, без изменения тел, и переключить обе спеки на импорт.

- [ ] **Шаг 2: прогнать — должно упасть**

```bash
pnpm test:e2e e2e/tier1/22-ticket-flags.spec.ts
```

Ожидание: FAIL — таких testid в дереве нет.

- [ ] **Шаг 3: написать компонент**

`src/features/trade/ExecutionFlags.tsx`:

```tsx
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function Flag({
  id,
  label,
  checked,
  onChange,
  disabled,
  testId,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-1.5 text-[11px] ${disabled ? "text-muted/50" : "text-muted"}`}
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
        data-testid={testId}
      />
      {label}
    </label>
  );
}

/**
 * Три флага исполнения плюс TP/SL.
 *
 * @remarks
 * `IOC` всегда неактивен: срока действия нет ни в теле `POST /orders`, ни в
 * схеме заказов — заказанный `IOC` всегда исполнялся как `GTC`. Флажок
 * показывается, потому что он есть в макете, и объясняет себя подсказкой:
 * рабочий вид у неработающего флага сказал бы неправду о том, как исполнится
 * ордер.
 */
export function ExecutionFlags({
  postOnly,
  onPostOnly,
  postOnlyAvailable,
  reduceOnly,
  onReduceOnly,
  tpsl,
  onTpsl,
}: {
  postOnly: boolean;
  onPostOnly: (v: boolean) => void;
  /** Только мейкерский принимают лишь лимитные виды ордера. */
  postOnlyAvailable: boolean;
  reduceOnly: boolean;
  onReduceOnly: (v: boolean) => void;
  tpsl: boolean;
  onTpsl: (v: boolean) => void;
}) {
  return (
    <TooltipProvider>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-4">
          <Flag
            id="flag-post-only"
            testId="flag-post-only"
            label="Post Only"
            checked={postOnly && postOnlyAvailable}
            onChange={onPostOnly}
            disabled={!postOnlyAvailable}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Flag
                  id="flag-ioc"
                  testId="flag-ioc"
                  label="IOC"
                  checked={false}
                  onChange={() => {}}
                  disabled
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Срок действия ордера шлюз не принимает — все ордера GTC.
            </TooltipContent>
          </Tooltip>
          <Flag
            id="flag-reduce-only"
            testId="flag-reduce-only"
            label="Reduce Only"
            checked={reduceOnly}
            onChange={onReduceOnly}
          />
        </div>
        <Flag
          id="tpsl-toggle"
          testId="tpsl-toggle"
          label="TP/SL"
          checked={tpsl}
          onChange={onTpsl}
        />
      </div>
    </TooltipProvider>
  );
}
```

- [ ] **Шаг 4: завести состояние и довести `reduceOnly` до черновика**

В `TradeForm.tsx` добавить состояние рядом с прежним `tpslOn`:

```ts
  const [postOnly, setPostOnly] = useState(false);
  const [reduceOnly, setReduceOnly] = useState(false);
```

Заменить прежний переключатель `tpsl-toggle` (он рисовался внутри формы) на

```tsx
      <ExecutionFlags
        postOnly={postOnly}
        onPostOnly={setPostOnly}
        postOnlyAvailable={tab === "Limit"}
        reduceOnly={reduceOnly}
        onReduceOnly={setReduceOnly}
        tpsl={tpslOn}
        onTpsl={setTpslOn}
      />
```

и дописать `reduceOnly` в **оба** входных черновика (рыночный и лимитный):

```ts
          reduceOnly,
```

В условном черновике вкладок `Stop` / `Take Profit` — тоже; прикреплённый
TP/SL остаётся жёстко `reduceOnly: true` независимо от флажка: он закрывает
позицию по определению.

`postOnly` на провод пока не уходит — черновик `@liq/core` 0.43.0 такого поля не
знает. Это закрывает задача 10 после релиза 0.44.0.

- [ ] **Шаг 5: прогнать e2e и гейт**

```bash
pnpm test:e2e e2e/tier1/22-ticket-flags.spec.ts
pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm test:e2e && pnpm build
```

- [ ] **Шаг 6: коммит**

```bash
git add -A src/features/trade e2e
git commit -m "feat(trade): флажки исполнения — рабочие там, где шлюз их принимает"
```

---

### Задача 9: сводка парой и две кнопки вместо одной

**Файлы:**
- Создать: `src/features/trade/OrderSummary.tsx`, `src/features/trade/SubmitButtons.tsx`
- Удалить: `src/features/trade/TradePreviewRow.tsx`
- Изменить: `src/features/trade/TradeForm.tsx`, `src/features/trade/useOrderSizing.ts`,
  `src/__tests__/__snapshots__/testid-inventory.test.ts.snap`
- Тест: `e2e/tier1/04-trade-form.spec.ts`, `e2e/tier1/07-order-submit.spec.ts`

**Интерфейсы:**
- Потребляет: `TicketSummary` (задача 4), `OrderVerdict` + `describeRejection`
  (задача 3), мутацию `submit` (задача 2).
- Отдаёт: `<OrderSummary summary baseSymbol quoteSymbol />`,
  `<SubmitButtons onSubmit disabled pending />`. Testid'ы: новые
  `order-qty`, `order-value`, `order-cost`, `submit-buy-button`,
  `submit-sell-button`; сохраняются `order-summary`, `order-liq-price`,
  `order-warning`, `insufficient-margin`, `trade-error`; **исчезают**
  `side-long-button`, `side-short-button`, `submit-order-button`,
  `order-margin`, `trade-preview`.

Сторона уезжает из состояния тикета в клик по кнопке: макет считает оба исхода
сразу и показывает их рядом, а выбор стороны делает нажатие. Поэтому
`useOrderSizing` перестаёт принимать `side` и перестаёт отдавать `sizeDelta` и
`liqPrice` — обе величины теперь у `summary.long` / `summary.short`.

Кнопки надписи не меняют: в макете они всегда `Buy / Long` и `Sell / Short`.
Слова отказа (`Min 0.001`, `Max 25×`) уезжают в строку `order-warning` под
блоком — она уже есть; кнопка при отказе просто неактивна.

**`TradePreviewRow` удаляется.** Во-первых, в макете его нет. Во-вторых,
`useTradePreview` — по собственной документации превью **пулового** пути
(`AsyncOrder`), а после задачи 2 терминал перестал уводить ордера мимо стакана:
отдыхающая лимитка исполнится не так, как показывает это превью. В-третьих, из
двух его показанных полей оба были неверными — SDK прямо предписывает
показывать `totalCost` вместо `fee` (комиссия без награды сеттлеру занижала
стоимость в девять раз на розничном объёме) и `priceImpactRatio` вместо
`priceImpact`, который на реальных размерах усекается в ноль. Чинить число,
которое перестало описывать путь ордера, дороже, чем убрать его; вернуться оно
может вкладкой `Pro`, которую макет не раскрывает.

- [ ] **Шаг 1: написать падающий e2e**

В `e2e/tier1/04-trade-form.spec.ts`:

```ts
test("сводка показывает обе стороны, ликвидации различаются", async ({ page }) => {
  await mountTerminal(page);
  await page.getByTestId("size-input").fill("1");
  await expect(page.getByTestId("order-qty")).toContainText("/");
  const liq = await page.getByTestId("order-liq-price").innerText();
  const [long, short] = liq.split("/").map((s) => s.trim());
  expect(long).not.toBe(short);
});

test("обе кнопки подают ордер своей стороной", async ({ page }) => {
  const world = await mountTerminal(page);
  await page.getByTestId("size-input").fill("0.1");
  await page.getByTestId("submit-sell-button").click();
  await expect.poll(() => world.submittedOrders.length).toBe(1);
  expect(world.submittedOrders[0].side).toBe("SELL");
  expect(BigInt(world.submittedOrders[0].sizeDelta)).toBeLessThan(0n);
});
```

- [ ] **Шаг 2: прогнать — должно упасть**

```bash
pnpm test:e2e e2e/tier1/04-trade-form.spec.ts
```

Ожидание: FAIL — таких testid нет.

- [ ] **Шаг 3: написать сводку**

`src/features/trade/OrderSummary.tsx`:

```tsx
import { fmtPrice, fmtQty, fmtUsd } from "../../lib/format";
import type { TicketSummary } from "./ticketSummary";

/**
 * Сводка тикета парой значений — как в макете.
 *
 * @remarks Первые три строки у обеих сторон совпадают по величине и
 * различаются только цветом: это один расчёт, показанный под оба исхода.
 * `Liq. Price` — единственная строка, где числа действительно разные, и
 * потому единственная без зелёно-красной подсветки.
 */
export function OrderSummary({
  summary,
  baseSymbol,
  quoteSymbol,
}: {
  summary: TicketSummary;
  baseSymbol: string;
  quoteSymbol: string;
}) {
  const dash = "—";
  return (
    <div className="flex flex-col gap-1 text-[11px]" data-testid="order-summary">
      <Paired
        label="Order qty."
        long={fmtQty(summary.qty)}
        short={fmtQty(summary.qty)}
        unit={baseSymbol}
        testId="order-qty"
      />
      <Paired
        label="Order value"
        long={fmtUsd(summary.value)}
        short={fmtUsd(summary.value)}
        unit={quoteSymbol}
        testId="order-value"
      />
      <Paired
        label="Cost"
        long={fmtUsd(summary.cost)}
        short={fmtUsd(summary.cost)}
        unit={quoteSymbol}
        testId="order-cost"
      />
      <div className="flex justify-between">
        <span className="text-muted">Liq. Price</span>
        <span className="text-text" data-testid="order-liq-price">
          {summary.long.liqPrice === null ? dash : fmtPrice(summary.long.liqPrice)}
          {" / "}
          {summary.short.liqPrice === null ? dash : fmtPrice(summary.short.liqPrice)}
        </span>
      </div>
    </div>
  );
}

function Paired({
  label,
  long,
  short,
  unit,
  testId,
}: {
  label: string;
  long: string;
  short: string;
  unit: string;
  testId: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span data-testid={testId}>
        <span className="text-long">{long}</span>
        <span className="text-muted"> / </span>
        <span className="text-short">{short}</span>
        <span className="text-muted"> {unit}</span>
      </span>
    </div>
  );
}
```

Прочерк вместо цены ликвидации ставится там, где уровня нет: ноль в этом месте
читался бы как достижимая цена.

- [ ] **Шаг 4: написать кнопки**

`src/features/trade/SubmitButtons.tsx`:

```tsx
import { Side } from "@liq/sdk";

import { Button } from "@/components/ui/button";

/**
 * Две кнопки подачи — сторона выбирается нажатием, а не хранится в тикете.
 *
 * @remarks Надписи постоянны: макет не показывает ни смены текста, ни
 * состояния «не хватает средств» на самой кнопке. Причина отказа живёт строкой
 * ниже, кнопка при отказе просто неактивна.
 */
export function SubmitButtons({
  onSubmit,
  disabled,
  pending,
}: {
  onSubmit: (side: Side) => void;
  disabled: boolean;
  pending: boolean;
}) {
  return (
    <div className="flex gap-2">
      <Button
        variant="long"
        className="flex-1"
        disabled={disabled || pending}
        onClick={() => onSubmit(Side.BUY)}
        data-testid="submit-buy-button"
      >
        Buy / Long
      </Button>
      <Button
        variant="short"
        className="flex-1"
        disabled={disabled || pending}
        onClick={() => onSubmit(Side.SELL)}
        data-testid="submit-sell-button"
      >
        Sell / Short
      </Button>
    </div>
  );
}
```

- [ ] **Шаг 5: убрать сторону из `useOrderSizing`**

Из параметров хука уходит `side`, из типа `OrderSizing` — поля `sizeDelta` и
`liqPrice` (остаётся `summary`). Тесты, читавшие `result.current.sizeDelta` и
`result.current.liqPrice`, переводятся на `result.current.summary.long.sizeDelta`
и `.summary.long.liqPrice`; там, где тест проверял шорт (`side: Side.SELL`),
читается `.summary.short.*`, а параметр `side` из вызова хука убирается.
Числовые ожидания не менять.

- [ ] **Шаг 6: собрать форму**

В `TradeForm.tsx`:

- удалить `const [side, setSide] = useState<Side>(Side.BUY);` и блок двух кнопок
  `side-long-button` / `side-short-button`;
- функция подачи принимает сторону: `function submit(side: Side) { … }`, внутри
  `const sizeDelta = side === Side.BUY ? sizing.summary.long.sizeDelta : sizing.summary.short.sizeDelta;`
  а `submitAttachedTpSl(sizeDelta, side)` вызывается уже с этой стороной;
- удалить `submitLabel` и одиночную кнопку; на её место:

```tsx
      <OrderSummary
        summary={sizing.summary}
        baseSymbol={sizing.baseSymbol}
        quoteSymbol="USD"
      />

      {rejection && (
        <div className="text-[11px] text-short" data-testid="order-warning">
          {rejection}
        </div>
      )}

      <SubmitButtons onSubmit={submit} disabled={disabled} pending={pending} />
```

где

```ts
  const rejection = describeRejection(sizing.validation.reason);
```

- удалить импорт и использование `TradePreviewRow`, затем
  `rm src/features/trade/TradePreviewRow.tsx`;
- `acceptablePrice` в рыночном черновике теперь считается от стороны-аргумента.

- [ ] **Шаг 7: обновить снапшот testid и оставшиеся e2e**

```bash
grep -rn "submit-order-button\|side-long-button\|side-short-button\|order-margin\|trade-preview" e2e/ src/
pnpm test -- testid-inventory -u
```

Каждое вхождение в e2e перевести: подача — на `submit-buy-button` /
`submit-sell-button`, выбор стороны — на них же (отдельного переключателя больше
нет). Снапшот пересобрать **после** правки дерева, а не до: он фиксирует
инвентарь, а не задаёт его.

- [ ] **Шаг 8: гейт**

```bash
pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm test:e2e && pnpm build
```

- [ ] **Шаг 9: коммит**

```bash
git add -A src e2e
git commit -m "feat(trade): сводка обеих сторон и две кнопки подачи по макету"
```

---

### Задача 10: `postOnly` на провод — после релиза SDK 0.44.0

**Предусловие:** PR `liqcx/monorepo#728` смержен в `staging`, тег `liq@0.44.0`
опубликован в оба реестра. **Не начинать раньше** — `pnpm install` иначе не
найдёт версию, а `^0.43.0` не допускает `0.44.0` (нулевой мажор).

**Файлы:**
- Изменить: `package.json`, `pnpm-lock.yaml`, `src/features/trade/TradeForm.tsx`
- Тест: `e2e/tier1/22-ticket-flags.spec.ts`

**Интерфейсы:**
- Потребляет: `LimitOrderDraft.postOnly` из `@liq/core` 0.44.0.

Флажок `Post Only` с задачи 8 хранит состояние, но на провод не уходит: у
черновика 0.43.0 такого поля нет. Здесь он доезжает до тела.

- [ ] **Шаг 1: поднять зависимости**

Во всех восьми строках `@liq/*` в `package.json` заменить `^0.43.0` на `^0.44.0`,
затем:

```bash
cd /Users/alex/Work/perps/terminal && pnpm install
grep -n "0.4[34].0" package.json
```

Ожидание: ни одной `0.43.0`.

- [ ] **Шаг 2: написать падающий e2e**

В `e2e/tier1/22-ticket-flags.spec.ts`:

```ts
test("Post Only доезжает до тела лимитного ордера", async ({ page }) => {
  const world = await mountTerminal(page);
  await page.getByTestId("trade-tab-limit").click();
  await page.getByTestId("flag-post-only").click();
  await page.getByTestId("limit-price-input").fill("2000");
  await page.getByTestId("size-input").fill("0.1");
  await page.getByTestId("submit-buy-button").click();
  await expect.poll(() => world.submittedOrders.length).toBe(1);
  expect(world.submittedOrders[0].postOnly).toBe(true);
});
```

- [ ] **Шаг 3: прогнать — должно упасть**

```bash
pnpm test:e2e e2e/tier1/22-ticket-flags.spec.ts
```

Ожидание: FAIL — `postOnly` в теле отсутствует.

- [ ] **Шаг 4: дописать поле в лимитный черновик**

В `TradeForm.tsx`, в ветке `tab === "Limit"`:

```ts
      submit.mutate(
        {
          kind: "limit",
          accountId,
          marketId,
          sizeDelta,
          side,
          limitPrice: price,
          reduceOnly,
          postOnly,
        },
        { onSuccess },
      );
```

Поле стоит только у лимитного: шлюз принимает его лишь у лимитных видов и
отвечает отказом на рыночных, а условный черновик собирает `*_MARKET`.

- [ ] **Шаг 5: прогнать и гейт**

```bash
pnpm test:e2e e2e/tier1/22-ticket-flags.spec.ts
pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm test:e2e && pnpm build
```

- [ ] **Шаг 6: коммит**

```bash
git add package.json pnpm-lock.yaml src/features/trade/TradeForm.tsx e2e/tier1/22-ticket-flags.spec.ts
git commit -m "feat(trade): post-only доезжает до тела ордера на SDK 0.44.0"
```

---

## Готовность фазы

Фаза закрыта, когда:

- `pnpm typecheck`, `node_modules/.bin/eslint .`, `pnpm test`, `pnpm build`,
  `pnpm test:e2e` — зелёные;
- `grep -rn "orderMath\|poolExecution\|SizeField\|SizePercent" src/` ничего не
  находит;
- каталога `src/features/trade/mutations/` не существует;
- снапшот `testid-inventory` пересобран и в нём нет `submit-order-button`,
  `side-long-button`, `side-short-button`, `size-unit-toggle`, `size-max-button`,
  `leverage-slider`, `size-pct-25/50/75/100`, `order-margin`, `trade-preview`;
- draft-PR в `liqu-fi/terminal`, база `main`.

---

## Поправки к плану (внесены при исполнении)

План писался до чтения топологии e2e и назвал файлы наугад. Реальность:

| В плане | На самом деле |
| --- | --- |
| `e2e/tier1/04-trade-form.spec.ts` | `e2e/tier1/04-trade-market.spec.ts` (рыночные), `05-trade-limit.spec.ts` (лимитные), `06-trade-conditional.spec.ts` (условные), `07-trade-gating.spec.ts` (гейтинг) |
| `e2e/tier1/07-order-submit.spec.ts` | `e2e/tier1/04-trade-market.spec.ts` |
| хелперы `mountTerminal` / `submitMarketOrder` | `enterTerminal(page, world)` из `e2e/pages/flows.ts`; фикстура даёт `{ page, world }` из `e2e/support/fixtures.ts` |
| локаторы по `page.getByTestId(...)` в спеках | **page object `TradePanel`** в `e2e/pages/TerminalPanels.ts` — единственное место, где живут локаторы тикета |

**Следствие, которое дороже самих имён:** каждое переименование `data-testid`
правится в `TerminalPanels.ts`, а не россыпью по спекам. Спека, которая ходит
мимо page object, — это регресс архитектуры тестов, а не «короче написать».

`e2e/tier1/14-trade-preview.spec.ts` проверяет `TradePreviewRow`, который
удаляет задача 9, — файл удаляется вместе с ним.

---

## Состояние на 2026-09-02

Задачи 1–9 закрыты (ветка `feat-cld/trade-ticket`, 11 коммитов). Условия
готовности фазы выполнены все, кроме одного: **задача 10 заблокирована**
внешним действием — PR `liqcx/monorepo#728` ещё открыт, тега `liq@0.44.0` нет,
поэтому `LimitOrderDraft.postOnly` установленному SDK неизвестен. Флажок
`Post Only` до релиза хранит состояние, но на провод не уходит.

Разбор каждого решения и каждого дефекта плана — в журнале
`.superpowers/sdd/2026-09-02-trade-ticket/progress.md`.
