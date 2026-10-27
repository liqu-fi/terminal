# TRM-27 в terminal: список движений отдельно от кривой — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** вкладки Account → Transactions и Overview показывают депозиты и выводы, когда шлюз прочитал их при недоступной кривой (`available: false`, `collateralEventsAvailable: true`), а подпись «не прочитано» стоит только тогда, когда список действительно не прочитан.

**Architecture:** одна задача, ветка `feat-cld/trm-27-collateral-read`, draft-PR в `main` liqu-fi/terminal. Одна чистая функция `collateralEventsRead` в `accountLogic.ts`, два потребителя.

**Tech Stack:** Vite + React, vitest, `@liq/*` 0.79.0 (`PortfolioResponse.collateralEventsAvailable`).

**Spec:** Plane TRM-27 (комментарий 21.10: остаток — показывать «не прочитано» по новому признаку); шлюзовая сторона — monorepo MR-242 (#1001), SDK 0.79.0 (#1002). Решение владельца 2026-10-27: TRM-27 и в terminal, отдельным PR после #86. Та же функция в liqu-web — план `liqu-web/docs/superpowers/plans/2026-10-27-sdk-079-trm27-trm126.md`, задача 2.

## Global Constraints

- Репо `liqu-fi/terminal`, база `origin/main`, ветка `feat-cld/trm-27-collateral-read`, worktree `/home/alex/Work/perps/terminal/.worktrees/trm-27`. Перед каждым коммитом — `git branch --show-current`.
- **Предусловие:** liqu-fi/terminal#86 (`@liqpro/*` 0.79.0) влит в `main`. Если нет — задача `BLOCKED`, ничего не делать.
- pnpm из `packageManager` (11.1.2); `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`; `pnpm exec repo-rules check` и `pnpm exec repo-rules diff --base origin/main`.
- Комментарии — TSDoc и только где логика не очевидна, язык — как у соседнего кода; тексты интерфейса — по-английски, существующие (`EVENTS_UNAVAILABLE`, `src/lib/format.ts:86`) не меняются.
- Коммиты — по-русски, `fix(account): … (TRM-27)`, хвост `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Шлюз старше MR-242 (поля нет): ровно прежнее поведение — события при `available: true`, подпись `EVENTS_UNAVAILABLE` при `available: false`.
2. `available: false` + `collateralEventsAvailable: true`: строки депозитов и выводов видны, подписи нет; карточки сводки и график по-прежнему «—» (они на `available`).
3. `collateralEventsAvailable: false` при `available: true` (теоретически): событий нет, подпись есть.

---

### Task 1: `collateralEventsRead` и его два потребителя

**Files:**

- Modify: `src/features/account/accountLogic.ts` — новый `collateralEventsRead` рядом с `activityRows` (`:174`)
- Modify: `src/features/account/TransactionsTab.tsx:136-160` (`events`), `:217-222` (подпись `transactions-events-unavailable`)
- Modify: `src/features/account/OverviewTab.tsx:77-84` (`activity`), `:196-204` (подпись `recent-activity-events-unavailable`)
- Test: `src/features/account/__tests__/accountLogic.test.ts`

**Interfaces:**

- Consumes: `PortfolioResponse.collateralEventsAvailable?: boolean` (`@liq/api-client` 0.79).
- Produces: `collateralEventsRead(portfolio: PortfolioResponse | undefined): readonly PortfolioCollateralEvent[] | null`.

**Решения (не переоткрывать):**

- Правило — то же, что в liqu-web: ответа нет → `null`; `collateralEventsAvailable === true` → `portfolio.collateralEvents`; `=== false` → `null`; поля нет → `portfolio.available ? portfolio.collateralEvents : null`.
- Строки: `activityRows(collateralEventsRead(x) ?? [], ledger)`. Подпись «не прочитано»: прежние условия (`!pending && !failed`), но вместо `portfolio?.available === false` — `portfolio !== undefined && collateralEventsRead(portfolio) === null`. Всё остальное, что смотрит на `available` (сводка, P&L за день, график), не меняется.
- Комментарий в `TransactionsTab.tsx:137-146` и над подписью в `OverviewTab.tsx:192-195` переписать под новое правило: «не прочитано» — это признак списка, а не кривой.

- [ ] **Step 0: Предусловие**

Run: `git fetch origin && git rebase origin/main && grep -c '@\^0\.79\.0' package.json`
Expected: `5`. Иначе — `BLOCKED: #86 не влит`. Затем `pnpm install`.

- [ ] **Step 1: Failing test**

`accountLogic.test.ts`, `describe('collateralEventsRead')`, ответ с одним выводом: `undefined` → `null`; `{ available: true }` без поля → список; `{ available: false }` без поля → `null`; `{ available: false, collateralEventsAvailable: true }` → тот же массив; `{ available: true, collateralEventsAvailable: false }` → `null`.

- [ ] **Step 2: Прогнать и увидеть FAIL**

Run: `pnpm vitest run src/features/account/__tests__/accountLogic.test.ts`
Expected: FAIL — `collateralEventsRead` не экспортирован.

- [ ] **Step 3: Реализовать** функцию и два потребителя по «Решениям».

- [ ] **Step 4: Гейты**

Run: `pnpm vitest run src/features/account && pnpm typecheck && pnpm test && pnpm lint && pnpm build && pnpm exec repo-rules check && pnpm exec repo-rules diff --base origin/main`
Expected: PASS (`lint` — 0 ошибок).

- [ ] **Step 5: Коммит**

`git add` четырёх файлов задачи; `fix(account): депозиты и выводы видны при недоступной кривой, «не прочитано» — по collateralEventsAvailable (TRM-27)`.
