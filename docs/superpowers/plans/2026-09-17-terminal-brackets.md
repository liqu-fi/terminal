# Скобки терминала на действии SDK: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Тикет и диалог TP/SL терминала перестают считать скобки сами и зовут `useApplyBracketsMutation` из `@liq/react` 0.54.0: ноги уходят в одной связке, отказ по любой ноге виден, `tpslPlan.ts` и мёртвые ветки тикета удалены, e2e проверяет обе стороны входа и наследование связки.

**Architecture:** Бамп `@liq/*` до `^0.54.0` едет одним коммитом с переводом `TpSlDialog` и удалением `tpslPlan.ts` — `Bracket.groupId` стало обязательным, и старый тест плана типизацию ломает. Тикет теряет второй наблюдатель мутации и собственную копию правила направления. Мок e2e начинает переносить `groupId` из тела подачи в созданный ордер, иначе `positionBrackets` в тестах не видит связку.

**Tech Stack:** React 19 + Vite, TypeScript, TanStack Query 5, `@liq/*` 0.54.0, Playwright (tier-1 на моках), vitest (юниты), pnpm 11 + moon.

**Spec:** `docs/superpowers/specs/2026-09-17-terminal-brackets-design.md`

## Global Constraints

- Репозиторий `~/Work/perps/terminal`, ветка `feat-cld/position-brackets` от `main@f7e4cc8` (уже создана, чекаут на ней). Проверять `git branch --show-current` перед каждым коммитом. Не пушить до задачи 4.
- **Задача 1 не начинается, пока `rtk proxy npm view @liqpro/liq-core version` не вернёт `0.54.0`.** CI-джоба публикации в npm красная с 0.52.0, вторую половину релиза владелец публикует руками; до этого `pnpm install` просто не найдёт версию.
- Вывод `pnpm`/`npm`/`moon` с кириллицей роняет хук rtk — запускать через `rtk proxy <команда>`. При подозрительном коде возврата перепроверять сырым бинарём.
- Коммитить только перечисленные в задаче файлы (`git add <файлы>`), никогда `git add -A`. Каждый коммит завершается строкой `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Pre-commit хука и prettier в репозитории нет (проверено: ни `core.hooksPath`, ни `.husky/`, ни зависимости `prettier`) — форматирование и типы держит только `eslint .` + `tsc -b`, поэтому гейты каждой задачи прогоняются руками, а не «хук проверит».
- Контракт `data-testid` — инвариант: существующие идентификаторы (`tpsl-dialog`, `tpsl-tp-input`, `tpsl-sl-input`, `tpsl-save`, `tpsl-error`, `entry-tp-input`, `entry-sl-input`, `tpsl-toggle`, `trade-error`) не переименовываются и не исчезают.
- Макет — контракт: ни одна задача не убирает элементы UI. Удаляются только мёртвые ветки кода (`attachable`, `if (tab === "Limit")`), а не поля и не кнопки.
- Комментарии — русский TSDoc в стиле соседей; пояснять «почему», а не «что». Словарь: **скобки**, **нога**, **связка**.
- Фрагменты кода в плане — содержание, а не форматирование: переносы строк и кавычки приводит `eslint .` (prettier в репозитории нет). Расхождение с планом в отступах дефектом не считается, расхождение в значениях — считается.
- Юнит-тесты: `rtk proxy pnpm test`. Типы: `rtk proxy pnpm typecheck`. Линт: `rtk proxy pnpm lint`. E2E tier-1: `rtk proxy pnpm test:e2e` (холодный старт vite прогревается в globalSetup; порт задаётся `E2E_PORT`).
- Исполнение по HARD RULE workspace: `plan-state init docs/superpowers/plans/2026-09-17-terminal-brackets.md` до задачи 1; implementer получает `REQUIRED SKILL: implement-task`, reviewer — `REQUIRED SKILL: review-task`.
- Один draft-PR в `main` (`gh pr create --draft --base main`) в задаче 4. **PR не мержится, пока открыт `liqcx/monorepo#784`** (шлюз не проверяет владельца связки) — это записывается в тело PR.

## Карта файлов

| файл | ответственность |
| --- | --- |
| `package.json` | `@liq/*` → `npm:@liqpro/liq-*@^0.54.0` |
| `src/features/positions/TpSlDialog.tsx` | правка скобок через `useApplyBracketsMutation` |
| `src/features/positions/tpslPlan.ts`, `src/features/positions/__tests__/tpslPlan.test.ts` | удаляются |
| `src/features/trade/TradeForm.tsx` | скобки входа через то же действие; мёртвые ветки удалены |
| `e2e/support/world.ts` | `groupId` в копии `GatewayOrder` и в фикстуре условного ордера |
| `e2e/support/mockGateway.ts` | `groupId` из тела подачи переносится в созданный ордер |
| `e2e/tier1/04-trade-market.spec.ts` | скобки входа: long и short, общая связка, отказ по TP |
| `e2e/tier1/28-position-actions.spec.ts` | отмена ждётся опросом (порядок сменился); замена ноги: та же связка |

---

### Task 1: Бамп 0.54.0, диалог TP/SL на действие SDK, `tpslPlan` удалён

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Modify: `src/features/positions/TpSlDialog.tsx`
- Modify: `e2e/tier1/28-position-actions.spec.ts` (одна синхронная проверка отмены становится ожиданием)
- Delete: `src/features/positions/tpslPlan.ts`, `src/features/positions/__tests__/tpslPlan.test.ts`

**Interfaces:**
- Consumes (из SDK 0.54.0): `useApplyBracketsMutation(accountId: bigint | undefined, opts?)` → мутация с `mutate(input, { onSuccess })`, `isPending`, `error: Error | null` (`mutate` из TanStack v5 сам не отклоняется — `onError` не нужен); `ApplyBracketsInput { position: Pick<Position,'marketId'|'side'|'size'>; brackets: PositionBrackets; takeProfit: Price; stopLoss: Price }`. Ошибка — одна строка вида `Take profit: …; Stop loss: …`.
- Produces: `TpSlDialog` без собственного плана и без собственных `pending`/`error`; `tpslPlan` в терминале больше нет (задача 2 не может на него сослаться).

- [ ] **Step 1: Проверить, что релиз доехал**

Run: `rtk proxy npm view @liqpro/liq-core version`
Expected: `0.54.0`. Если печатает `0.53.0` — СТОП, задача не начинается (владелец публикует вторую половину релиза руками); доложить NEEDS_CONTEXT.

- [ ] **Step 2: Бамп пяти псевдонимов**

В `package.json` заменить `^0.53.0` на `^0.54.0` в пяти строках блока `dependencies`:

```json
    "@liq/api-client": "npm:@liqpro/liq-api-client@^0.54.0",
    "@liq/core": "npm:@liqpro/liq-core@^0.54.0",
    "@liq/react": "npm:@liqpro/liq-react@^0.54.0",
    "@liq/sdk": "npm:@liqpro/liq-sdk@^0.54.0",
    "@liq/turnkey": "npm:@liqpro/liq-turnkey@^0.54.0",
```

Run: `rtk proxy pnpm install`
Expected: установка проходит, `pnpm-lock.yaml` меняется. Проверить: `rtk proxy pnpm list @liq/core | grep 0.54` печатает `0.54.0`.

- [ ] **Step 3: Убедиться, что бамп в одиночку красный**

Run: `rtk proxy pnpm typecheck`
Expected: FAIL в `src/features/positions/__tests__/tpslPlan.test.ts` — литерал скобки без `groupId` (поле стало обязательным в `Bracket`). Это и есть причина, по которой бамп и удаление едут одним коммитом; зафиксировать вывод в отчёте.

- [ ] **Step 4: Диалог — на действие SDK**

Заменить содержимое `src/features/positions/TpSlDialog.tsx` на:

```tsx
import { Price } from "@liq/sdk";
import { useAccountId, useApplyBracketsMutation } from "@liq/react";
import { wadToFixed } from "@liq/core";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { parseOrZero } from "../../lib/format";
import { DecimalInput } from "../../components/ui/DecimalInput";
import type { PositionRow } from "./usePositionRows";

/**
 * Правка скобок одной позиции.
 *
 * @remarks Поля предзаполнены текущими триггерами: диалог показывает состояние,
 * а не пустой бланк, — иначе «Save» с нетронутым полем снял бы обе скобки.
 * Начальное значение берётся при монтировании, а родитель монтирует диалог с
 * `key` по рынку: сброс полей через эффект переписывал бы уже набранное на
 * каждом опросе позиций.
 *
 * План правки, порядок «подача, потом отмена», связка ног и сбор отказов живут
 * в `useApplyBracketsMutation`: то же действие зовёт тикет для скобок входа, и
 * второй копии правила у терминала больше нет.
 */
export function TpSlDialog({
  row,
  onClose,
}: {
  row: PositionRow;
  onClose: () => void;
}) {
  const accountId = useAccountId();
  const applyBrackets = useApplyBracketsMutation(accountId);
  const [tp, setTp] = useState(() =>
    row.brackets.takeProfit
      ? wadToFixed(row.brackets.takeProfit.triggerPrice, 2)
      : "",
  );
  const [sl, setSl] = useState(() =>
    row.brackets.stopLoss
      ? wadToFixed(row.brackets.stopLoss.triggerPrice, 2)
      : "",
  );

  // `mutate` (не `mutateAsync`): отказ показывается из `applyBrackets.error`
  // ниже, а диалог остаётся открытым — закрывать его поверх ошибки значило бы
  // прятать её.
  function save() {
    applyBrackets.mutate(
      {
        position: row.position,
        brackets: row.brackets,
        // Пустое поле — `0n`, то есть «снять». `parseOrZero` отдаёт голый
        // `bigint`, а действие ждёт `Price`, поэтому бренд возвращается явно.
        takeProfit: Price(parseOrZero(Price.parse, tp)),
        stopLoss: Price(parseOrZero(Price.parse, sl)),
      },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        data-testid="tpsl-dialog"
        overlayTestId="dialog-overlay"
        className="w-[min(320px,calc(100vw-2rem))]"
      >
        <DialogHeader className="mb-3">
          <DialogTitle className="text-sm font-semibold">
            TP / SL — {row.symbol}
          </DialogTitle>
        </DialogHeader>

        <label className="mb-1 block text-[10px] uppercase text-muted">
          Take profit
        </label>
        <DecimalInput
          value={tp}
          onValueChange={setTp}
          maxDecimals={2}
          placeholder="0.00"
          data-testid="tpsl-tp-input"
        />

        <label className="mb-1 mt-3 block text-[10px] uppercase text-muted">
          Stop loss
        </label>
        <DecimalInput
          value={sl}
          onValueChange={setSl}
          maxDecimals={2}
          placeholder="0.00"
          data-testid="tpsl-sl-input"
        />

        <p className="mt-2 text-[11px] text-muted">
          Empty field removes the bracket. Orders are reduce-only.
        </p>

        {applyBrackets.error && (
          <p className="mt-2 text-[11px] text-short" data-testid="tpsl-error">
            {applyBrackets.error.message}
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={onClose}
            data-testid="tpsl-cancel"
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={applyBrackets.isPending || accountId === undefined}
            onClick={save}
            data-testid="tpsl-save"
          >
            {applyBrackets.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Удалить копию правила**

```bash
git rm src/features/positions/tpslPlan.ts src/features/positions/__tests__/tpslPlan.test.ts
```

Проверить, что на них больше никто не ссылается:

Run: `rg -n "tpslPlan" src e2e || echo "нет ссылок"`
Expected: `нет ссылок`.

- [ ] **Step 6: Гейты**

Run: `rtk proxy pnpm typecheck && rtk proxy pnpm lint && rtk proxy pnpm test`
Expected: всё зелёное; число юнит-тестов уменьшается на тесты `tpslPlan` (их шесть).

- [ ] **Step 7: Спека диалога — снять зашитый старый порядок**

Одна проверка в `e2e/tier1/28-position-actions.spec.ts` молча кодировала порядок «отмена, потом подача»: в тесте `"editing TP cancels the old trigger and submits a new one"` опрос ждёт подачу, а отмену проверяет синхронно (строка ~125):

```ts
    await expect.poll(() => world.submittedOrders.length).toBe(1);
    // Шлюз не умеет менять триггер на месте: правка — отмена и подача.
    expect(world.cancelledOrderIds).toContain("tp-1");
```

С новым порядком DELETE уходит **после** POST, и на этой строке отмены ещё нет. Заменить на ожидание:

```ts
    await expect.poll(() => world.submittedOrders.length).toBe(1);
    // Шлюз не умеет менять триггер на месте: правка — отмена и подача. Отмена
    // ждётся, а не читается сразу: она уходит после подачи — замену подают
    // первой, чтобы позиция не осталась без скобки, если подача не пройдёт.
    await expect.poll(() => world.cancelledOrderIds).toContain("tp-1");
```

Остальные проверки отмены в файле не трогать: на строке ~92 отменяет `useClosePositions` (не наше действие), на ~149 отмена уже ждётся опросом.

Run: `rtk proxy pnpm test:e2e e2e/tier1/28-position-actions.spec.ts`
Expected: PASS. Если красным падает что-то ещё — это регрессия перевода, а не устаревшее ожидание: доложить, не переписывать спеку.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml src/features/positions/TpSlDialog.tsx src/features/positions/tpslPlan.ts src/features/positions/__tests__/tpslPlan.test.ts e2e/tier1/28-position-actions.spec.ts
git commit -m "$(cat <<'EOF'
feat(positions)!: диалог TP/SL на useApplyBracketsMutation — SDK 0.54.0, копия правила удалена

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Тикет — скобки входа тем же действием, мёртвые ветки удалены

**Files:**
- Modify: `src/features/trade/TradeForm.tsx`
- Modify: `src/features/trade/ExecutionFlags.tsx`

**Interfaces:**
- Consumes (задача 1): `useApplyBracketsMutation(accountId)` уже стоит в диалоге; `tpslPlan` удалён. `parseOrZero` отдаёт `bigint`, бренд `Price` возвращается явно — как в задаче 1.
- Produces: тикет без собственного правила направления, без второго наблюдателя мутации и без веток `attachable` / `if (tab === "Limit")`; `ExecutionFlags` без пропа `tpslAvailable`.

- [ ] **Step 1: Действие вместо второго наблюдателя**

В `src/features/trade/TradeForm.tsx`:

1. В многострочный импорт `@liq/react` добавить `useApplyBracketsMutation` второй строкой (список отсортирован):

```tsx
import {
  useAccountId,
  useApplyBracketsMutation,
  useAvailableMarginQuery,
  useOrderSubmission,
  useSessionStage,
  useTradeStore,
} from "@liq/react";
```

Импорт `useMutation` из `@tanstack/react-query` остаётся: на нём по-прежнему держится `submitOrder` (строка 65).

2. Удалить второй наблюдатель вместе с его комментарием:

```tsx
  // Прикреплённые TP/SL идут ОТДЕЛЬНОЙ мутацией, хотя функция подачи та же.
  // Они отправляются из `onSuccess` входного ордера, а повторный `mutate` на том
  // же наблюдателе сбрасывает его `mutateOptions` прямо посреди чужого колбэка —
  // TanStack валится в `Cannot read properties of undefined (reading 'onSettled')`.
  const submitAttached = useMutation({ mutationFn: submitDraft });
```

и на его месте поставить:

```tsx
  // Скобки входа — то же действие, что у диалога позиции: план, связка ног,
  // порядок подачи и сбор отказов живут в SDK.
  const applyBrackets = useApplyBracketsMutation(accountId);
```

3. Строку `const attachable = tab === "Market" || tab === "Limit";` удалить целиком (обе вкладки принимают скобки — после сноса вкладок Stop/TP условие всегда истинно).

4. Строку `const error = submitOrder.error ?? submitAttached.error;` заменить на:

```tsx
  const error = submitOrder.error ?? applyBrackets.error;
```

5. Строку `const pending = submitOrder.isPending;` заменить на:

```tsx
  // Пока SDK подаёт ноги, тикет ещё занят: `submitOrder.isPending` гаснет на
  // принятом входе, а скобки уходят после него. Без этого второй вход в то же
  // окно отцепил бы наблюдатель мутации от первого, и отказ по его скобкам
  // никто бы не показал.
  const pending = submitOrder.isPending || applyBrackets.isPending;
```

Тот же запрет уже стоит у соседнего потребителя хука — `TpSlDialog` держит
`disabled={applyBrackets.isPending || accountId === undefined}`.

- [ ] **Step 2: Правило направления — из тикета вон**

Заменить функцию `submitAttachedTpSl` (весь блок от комментария `// Reduce-only TP/SL submitted after a confirmed entry…` до закрывающей скобки перед комментарием `// \`mutate\` (not \`mutateAsync\`)…`) на:

```tsx
  // Скобки входа: позиция размером со вход и пустые существующие скобки —
  // вход ничего не отменяет. Куда смотрит триггер, чем закрывается позиция и в
  // какой связке стоят ноги, решает действие SDK; подаются они после того, как
  // шлюз принял вход, то есть не атомарно с ним.
  function attachBrackets(entryDelta: Qty, entrySide: Side) {
    if (!tpslOn || accountId === undefined || marketId === undefined) return;
    // `mutate`, как и вход: отказ приходит в `applyBrackets.error` и печатается
    // строкой `trade-error`.
    applyBrackets.mutate({
      position: { marketId, side: entrySide, size: entryDelta },
      brackets: { takeProfit: null, stopLoss: null },
      takeProfit: Price(parseOrZero(Price.parse, tp)),
      stopLoss: Price(parseOrZero(Price.parse, sl)),
    });
  }
```

В многострочный импорт `@liq/sdk` добавить тип `Qty` (`sizing.summary.<long|short>.sizeDelta` — брендированный `Qty`, а не голый `bigint`):

```tsx
import {
  acceptablePrice,
  Bps,
  describeRejection,
  describeWarning,
  Price,
  type Qty,
  Side,
} from "@liq/sdk";
```

`position: { marketId, side: entrySide, size: entryDelta }` — знак уже стоит верный: `sizeDelta` у шорта отрицателен, а `toSignedSize` внутри `closingOrderFor` отрицательный размер не переворачивает. Считать знак в тикете не нужно.

- [ ] **Step 3: Вызов и мёртвая ветка вкладки**

В `submit(side)`:

1. В `onSuccess` заменить `submitAttachedTpSl(sizeDelta, side);` на `attachBrackets(sizeDelta, side);`.
2. Ветку лимитного вида развернуть — после `return` в ветке Market остаётся единственная вкладка:

```tsx
    const price = parsedTabPrice();
    if (price <= 0n) return;

    // `acceptablePrice` у лимитного черновика нет: подписанное сообщение
    // приравнивает его к лимитной цене — лимитка исполняется по ней или лучше.
    submitOrder.mutate(
      {
        kind: "limit",
        accountId,
        marketId,
        sizeDelta,
        side,
        limitPrice: price,
        reduceOnly,
        // Post-only принимает только лимитная семья — на рыночных шлюз
        // отвечает отказом, поэтому у рыночного и условного черновиков поля
        // нет по типу, а не по забывчивости.
        postOnly,
      },
      { onSuccess },
    );
```

- [ ] **Step 4: Разметка без `attachable`**

В JSX `TradeForm`: у `<ExecutionFlags …>` удалить строку `tpslAvailable={attachable}`, а блок

```tsx
        {attachable && (
          <EntryTpSlFields
            enabled={tpslOn}
            tp={tp}
            setTp={setTp}
            sl={sl}
            setSl={setSl}
          />
        )}
```

заменить на безусловный:

```tsx
        <EntryTpSlFields
          enabled={tpslOn}
          tp={tp}
          setTp={setTp}
          sl={sl}
          setSl={setSl}
        />
```

В `src/features/trade/ExecutionFlags.tsx` убрать проп `tpslAvailable` из деструктуризации и из типа пропсов, а флажок TP/SL рендерить безусловно:

```tsx
        <Flag
          testid="tpsl-toggle"
          label="TP / SL"
          checked={tpsl}
          onChange={onTpsl}
        />
```

(`{tpslAvailable && (` … `)}` вокруг него удаляется; сам флажок и его `data-testid` остаются.)

- [ ] **Step 5: Мёртвого кода не осталось**

Run: `rg -n "submitAttached|attachable|tpslAvailable|submitAttachedTpSl" src || echo "нет ссылок"`
Expected: `нет ссылок`.

- [ ] **Step 6: Гейты**

Run: `rtk proxy pnpm typecheck && rtk proxy pnpm lint && rtk proxy pnpm test`
Expected: всё зелёное.

- [ ] **Step 7: E2E тикета (пока в прежнем виде)**

Run: `rtk proxy pnpm test:e2e e2e/tier1/04-trade-market.spec.ts e2e/tier1/22-ticket-flags.spec.ts`
Expected: PASS. Существующая спека `attaches reduce-only TP/SL conditional orders after a long entry` должна пройти без правок: направление, `reduceOnly` и знак размера у действия SDK те же. Если она красная — это настоящая регрессия, а не устаревшее ожидание: доложить, не переписывать спеку.

- [ ] **Step 8: Commit**

```bash
git add src/features/trade/TradeForm.tsx src/features/trade/ExecutionFlags.tsx
git commit -m "$(cat <<'EOF'
refactor(trade): скобки входа через useApplyBracketsMutation, мёртвые ветки вкладок удалены

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: E2E — связка видна моку и проверена в спеках

**Files:**
- Modify: `e2e/support/world.ts` (`GatewayOrder`, `conditionalOrderFixture`)
- Modify: `e2e/support/mockGateway.ts` (перенос `groupId` из тела подачи)
- Modify: `e2e/tier1/04-trade-market.spec.ts`
- Modify: `e2e/tier1/28-position-actions.spec.ts` (только наследование связки — зашитый старый порядок снят в задаче 1)

**Interfaces:**
- Consumes (задачи 1–2): оба пути терминала подают скобки через `useApplyBracketsMutation`; ноги несут `groupId`, замена наследует связку заменяемой.
- Produces: e2e-мок, у которого условный ордер несёт связку; спеки, проверяющие обе стороны входа, общую связку и видимый отказ по ноге.

Порядок «подача раньше отмены» здесь не проверяется: он закреплён юнит-тестом SDK (`applyBracketsMutation.test.tsx`), а в e2e потребовал бы журнала обращений в моке — лишняя механика ради второй проверки того же.

- [ ] **Step 1: Мок знает про связку**

В `e2e/support/world.ts` в интерфейс `GatewayOrder` после `createdAt: string;` добавить:

```ts
  /** Связка OCO; `null` — ордер без связки. */
  groupId: string | null;
```

В `conditionalOrderFixture` после `createdAt: "2026-01-01T00:00:00.000Z",` добавить `groupId: null,`.

В `e2e/support/mockGateway.ts` в сборке ордера из тела подачи (`const order: GatewayOrder = { … }`) после строки `createdAt: "2026-01-01T00:00:00.000Z",` добавить:

```ts
    // Связку шлюз возвращает в списках: без неё `positionBrackets` в e2e видит
    // `undefined`, и замена ноги получает новую связку вместо унаследованной —
    // то есть проверялось бы не то поведение, что в проде.
    groupId: payload.groupId != null ? String(payload.groupId) : null,
```

- [ ] **Step 2: Тест — скобки входа на обеих сторонах, в одной связке**

В `e2e/tier1/04-trade-market.spec.ts` заменить тест `"attaches reduce-only TP/SL conditional orders after a long entry"` на параметризованный по стороне входа:

```ts
  for (const entry of [
    {
      side: "buy" as const,
      label: "long",
      tp: "80000",
      sl: "60000",
      // Длинную закрывает продажа: TP срабатывает выше рынка, SL ниже.
      closeSide: "SELL",
      tpAbove: true,
      slAbove: false,
      negativeSize: true,
    },
    {
      side: "sell" as const,
      label: "short",
      tp: "60000",
      sl: "80000",
      // Короткую закрывает покупка, направления зеркальны.
      closeSide: "BUY",
      tpAbove: false,
      slAbove: true,
      negativeSize: false,
    },
  ]) {
    test(`attaches reduce-only TP/SL conditional orders after a ${entry.label} entry`, async ({
      page,
      world,
    }) => {
      const { trade } = await enterTerminal(page, world);

      await trade.setSize("0.5");
      await trade.tpslToggle.click();
      await trade.entryTpInput.fill(entry.tp);
      await trade.entrySlInput.fill(entry.sl);
      await trade.submit(entry.side);

      // entry MARKET + TAKE_PROFIT_MARKET + STOP_MARKET = 3 submits
      await expect.poll(() => world.submittedOrders.length).toBe(3);
      const tp = world.submittedOrders.find(
        (o) => o.orderType === "TAKE_PROFIT_MARKET",
      )!;
      const sl = world.submittedOrders.find(
        (o) => o.orderType === "STOP_MARKET",
      )!;

      // Направление триггера выводится из стороны позиции: перепутанное
      // сработало бы стопом сразу же.
      expect(tp.triggerAbove).toBe(entry.tpAbove);
      expect(sl.triggerAbove).toBe(entry.slAbove);
      expect(tp.side).toBe(entry.closeSide);
      expect(sl.side).toBe(entry.closeSide);
      // Обе ноги закрывают вход: размер противоположен входному.
      expect(String(tp.sizeDelta).startsWith("-")).toBe(entry.negativeSize);
      expect(String(sl.sizeDelta).startsWith("-")).toBe(entry.negativeSize);
      // Reduce-only: осиротевший триггер не откроет встречную позицию.
      expect(tp.reduceOnly).toBe(true);
      expect(sl.reduceOnly).toBe(true);
      // Одна связка на обе ноги: без неё сработавший TP не снимет стоп, и тот
      // переживёт позицию.
      expect(tp.groupId).toBeTruthy();
      expect(sl.groupId).toBe(tp.groupId);

      // TP/SL prices are cleared after a confirmed submit (no stale re-attach).
      await expect(trade.entryTpInput).toHaveValue("");
      await expect(trade.entrySlInput).toHaveValue("");
    });
  }
```

- [ ] **Step 3: Тест — отказ по TP виден, стоп всё равно подан**

Туда же, следом, добавить:

```ts
  test("a rejected take-profit leg is named, and the stop is still submitted", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);

    // Отказ конкретной ноге ставится здесь, а не в `mockGateway`: тот умеет
    // ронять только весь эндпоинт (`faults.submitOrderStatus`). Playwright
    // отдаёт приоритет маршруту, зарегистрированному последним, а
    // `route.fallback()` возвращает моку остальные подачи — вход и стоп.
    // Опросы списка сюда не заходят вовсе: они идут с `?status=…`, а точная
    // строка URL такой запрос не ловит — их по-прежнему обслуживает мок.
    await page.route(`${GATEWAY_URL}/orders`, async (route) => {
      const request = route.request();
      const body =
        request.method() === "POST"
          ? (request.postDataJSON() as { orderType?: string } | null)
          : null;
      if (body?.orderType === "TAKE_PROFIT_MARKET") {
        await route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "rejected", message: "rejected" },
          }),
        });
        return;
      }
      await route.fallback();
    });

    await trade.setSize("0.5");
    await trade.tpslToggle.click();
    await trade.entryTpInput.fill("80000");
    await trade.entrySlInput.fill("60000");
    await trade.submit();

    // Отказ по одной ноге не отменяет остальные: стоп защищает позицию и
    // подаётся, даже когда TP отвергнут.
    await expect
      .poll(() =>
        world.submittedOrders.filter((o) => o.orderType === "STOP_MARKET"),
      )
      .toHaveLength(1);
    // До 0.54.0 тикет этот отказ терял: вторая подача отцепляла наблюдатель
    // мутации от первой, и `trade-error` молчал.
    await expect(trade.tradeError).toContainText("Take profit");
  });
```

В импорты спеки добавить `GATEWAY_URL`: `import { GATEWAY_URL, WAD } from "../support/constants";`.

- [ ] **Step 4: Тест — замена встаёт в связку заменяемой**

В `e2e/tier1/28-position-actions.spec.ts` в тесте `"editing TP cancels the old trigger and submits a new one"` фикстуру существующего TP дополнить связкой, а в ожидания добавить её наследование:

```ts
      w.conditionalOrders = [
        conditionalOrderFixture({
          id: "tp-1",
          orderType: "TAKE_PROFIT_MARKET",
          triggerPrice: (90_000n * WAD).toString(),
          groupId: "11111111-2222-4333-8444-555555555555",
        }),
      ];
```

и после проверок нового ордера:

```ts
    // Замена встаёт в связку заменяемой: в новой связке сработавший стоп её
    // не снимет, и переставленный TP переживёт позицию.
    expect(order.groupId).toBe("11111111-2222-4333-8444-555555555555");
```

- [ ] **Step 5: E2E целиком**

Run: `rtk proxy pnpm test:e2e`
Expected: PASS весь tier-1. Если `04-trade-market` красная на шорте — это регрессия проводки, а не ожидание: доложить.

- [ ] **Step 6: Гейты**

Run: `rtk proxy pnpm typecheck && rtk proxy pnpm lint`
Expected: зелёные.

- [ ] **Step 7: Commit**

```bash
git add e2e/support/world.ts e2e/support/mockGateway.ts e2e/tier1/04-trade-market.spec.ts e2e/tier1/28-position-actions.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): связка в моке, скобки входа на обеих сторонах, отказ по ноге виден

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Спека, план и draft-PR

**Files:**
- Add: `docs/superpowers/specs/2026-09-17-terminal-brackets-design.md`, `docs/superpowers/plans/2026-09-17-terminal-brackets.md` (уже в дереве, не закоммичены)

**Interfaces:**
- Consumes: задачи 1–3 закоммичены, гейты зелёные.
- Produces: ветка на `origin`, один draft-PR в `main`.

- [ ] **Step 1: Закоммитить спеку и план**

```bash
git add docs/superpowers/specs/2026-09-17-terminal-brackets-design.md docs/superpowers/plans/2026-09-17-terminal-brackets.md
git commit -m "$(cat <<'EOF'
docs: спека и план скобок терминала

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Полный прогон перед PR**

Run: `rtk proxy pnpm typecheck && rtk proxy pnpm lint && rtk proxy pnpm test && rtk proxy pnpm build && rtk proxy pnpm test:e2e`
Expected: всё зелёное.

- [ ] **Step 3: Push и draft-PR**

```bash
git push -u origin feat-cld/position-brackets
```

Тело PR записать в `$TMPDIR/terminal-brackets-pr.md` (не в репозиторий):

```md
Тикет и диалог TP/SL больше не считают скобки сами: оба зовут `useApplyBracketsMutation` из `@liq/react` 0.54.0. Ноги уходят в одной связке (`groupId`, OCO), поэтому сработавший TP снимает стоп; отказ по любой ноге виден — до этого тикет терял отказ по TP, когда был заполнен и SL.

**Что внутри**
- `@liq/*` 0.53.0 → 0.54.0; `src/features/positions/tpslPlan.ts` и его тест удалены — правило уехало в SDK вместе с тестами.
- `TpSlDialog` без собственных `pending`/`error` и ручного `try/catch`.
- Тикет: копия правила направления, второй наблюдатель мутации и мёртвые ветки `attachable` / `tab === "Limit"` удалены.
- E2E: скобки входа проверяются на обеих сторонах, у ног один `groupId`, отказ по TP виден и стоп всё равно подан, замена ноги наследует связку; мок отдаёт `groupId` в списках.

Спека: `docs/superpowers/specs/2026-09-17-terminal-brackets-design.md`. SDK-часть: liqcx/monorepo#783, релиз `liq@0.54.0`.

**Не мержить, пока открыт liqcx/monorepo#784** — шлюз не проверяет владельца связки, и до этой проверки скобки не должны оказаться перед пользователями.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

```bash
gh pr create --draft --base main --head feat-cld/position-brackets \
	--title "feat(trade): скобки через useApplyBracketsMutation — связка OCO, отказ по ноге виден; SDK 0.54.0" \
	--body-file "$TMPDIR/terminal-brackets-pr.md"
```

Expected: URL draft-PR. `gh pr edit` в этом репозитории работает — обходной путь через `gh api` нужен только в `liqcx/monorepo`.

- [ ] **Step 4: Сверить пуш**

Run: `~/.claude/hooks/plan-state verify-push 4`
Expected: пуш подтверждён.

Живая проверка на staging (у ног входа один `groupId`; сработавший TP снимает SL) — после мёржа и выката, то есть после `liqcx/monorepo#784`. В объём плана она не входит и задачей не оформляется.
