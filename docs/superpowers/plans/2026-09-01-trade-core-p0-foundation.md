# Ф0 · Фундамент трейд-ядра — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перевести терминал на radix/shadcn, палитру макета и `Resizable`-оболочку экрана, не изменив ни одного наблюдаемого поведения — что доказывается зелёным tier-1 без правки локаторов.

**Architecture:** Фаза не добавляет данных и не трогает хуки SDK. Сначала ставится страж инвентаря `data-testid` (снапшот vitest), потом инфраструктура (alias `@/`, `components.json`, `cn`), потом палитра, потом примитивы по одному, потом стор состояния экрана и оболочка на `react-resizable-panels`. Порядок выбран так, чтобы страж существовал раньше первой правки разметки.

**Tech Stack:** React 19, Vite 8, Tailwind v4 (`@theme inline`), TypeScript 6, vitest 4 (environment `node`), Playwright 1.60, `shadcn/ui` + `radix-ui`, `zustand` 5, `react-resizable-panels` (через shadcn `resizable`), `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`.

**Spec:** `docs/superpowers/specs/2026-09-01-trade-core-design.md`

## Global Constraints

- **Ветка:** `feat-cld/terminal-trade-core`. PR — **draft**, в репозиторий **`liqu-fi/terminal`** (не в копию под `liqcx`). Ветка уже создана и содержит два коммита апгрейда SDK до 0.42.0, не влитых в `origin/main` — они уходят в этот же PR.
- **Контракт `data-testid` — инвариант.** Ни один существующий идентификатор не переименовывается и не исчезает. 91: 71 статический, 8 шаблонных и 12 приходящих в DOM пропом (`testid` у `Centered` / `ErrorLine` / `Empty`, `order-margin` и `order-liq-price` в `TradeForm`). Новые блоки получают новые идентификаторы.
- **Никакой доменной логики в терминале.** Фаза не добавляет вычислений над ценами, размерами и маржой. Всё, что считается, уже посчитано в `@liq/*`.
- **Никаких самописных UI-примитивов.** Компонент ставится `shadcn` CLI и правится под токены; новый примитив с нуля — признак ошибки.
- **Палитра снята с макета** (`monorepo/Trading_Flows/Frame.png`), а не взята из Liqu: Liqu брендирован (`#8eed2e` / `#ed2472`), эталон нейтрален.
- **Гейт каждой задачи:** `pnpm typecheck && node_modules/.bin/eslint . && pnpm test`. Линтер зовётся бинарём, а не `pnpm lint`: скрипт разрешается через PATH в чужой глобальный ESLint 9.25.1 и падает на плоском конфиге, локальный — 10.4.1. Гейт задач, трогающих разметку, дополнительно: `pnpm test:e2e`.
- **Коммит после каждой задачи**, сообщение на русском, в conventional-формате.

---

### Task 1: Страж инвентаря `data-testid`

Стража ставим первым: любая последующая задача правит разметку, и без него потеря идентификатора всплывёт только на e2e-прогоне — через десяток минут и без указания, что именно пропало.

**Files:**
- Create: `src/__tests__/collectTestIds.ts`
- Create: `src/__tests__/testid-inventory.test.ts`
- Create (автоматически, первым прогоном): `src/__tests__/__snapshots__/testid-inventory.test.ts.snap`

**Interfaces:**
- Consumes: ничего.
- Produces: `collectTestIds(root?: string): string[]` (по умолчанию `"src"`) — отсортированный список идентификаторов; шаблонные (`` data-testid={`order-row-${o.id}`} ``) нормализуются в `order-row-*`.

- [ ] **Step 1: Написать сборщик**

`src/__tests__/collectTestIds.ts`:

```ts
import { globSync, readFileSync } from "node:fs";

const STATIC = /data-testid="([^"]+)"/g;
const TEMPLATE = /data-testid=\{`([^`]+)`\}/g;
// Идентификатор доезжает до DOM и пропом: `<DialogContent overlayTestId="…">`.
// Инвентарь считает идентификаторы, а не синтаксис их передачи, иначе перевод
// оверлея на проп читался бы как потеря контракта.
const PROP = /(?:overlayTestId|testid)="([^"]+)"/g;

/**
 * Инвентарь `data-testid` исходников. Шаблонный идентификатор нормализуется
 * подстановкой `*` вместо интерполяции: `order-row-${o.id}` → `order-row-*`,
 * иначе снапшот менялся бы от переименования локальной переменной.
 */
export function collectTestIds(root = "src"): string[] {
  const files = globSync(`${root}/**/*.tsx`);
  const ids = new Set<string>();
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const [, id] of source.matchAll(STATIC)) ids.add(id);
    for (const [, tpl] of source.matchAll(TEMPLATE))
      ids.add(tpl.replace(/\$\{[^}]*\}/g, "*"));
    for (const [, id] of source.matchAll(PROP)) ids.add(id);
  }
  return [...ids].sort();
}
```

- [ ] **Step 2: Написать тест**

`src/__tests__/testid-inventory.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { collectTestIds } from "./collectTestIds";

describe("инвентарь data-testid", () => {
  it("не теряет идентификаторов, на которые ходит e2e", () => {
    const ids = collectTestIds();
    // Якоря: без них падение снапшота нечем прочитать глазами.
    expect(ids).toContain("terminal-root");
    expect(ids).toContain("dialog-overlay");
    expect(ids).toContain("order-row-*");
    expect(ids).toMatchSnapshot();
  });
});
```

- [ ] **Step 3: Прогнать и записать снапшот**

Run: `pnpm test -- testid-inventory`
Expected: PASS, в выводе `1 snapshot written`. Открыть снапшот и убедиться, что в нём **91** запись (71 статический + 8 шаблонных + 12 пропом). Двенадцать пропом — это уже живая конвенция репозитория: `Centered` / `ErrorLine` (`SessionGate.tsx`) и `Empty` (`PositionsTable.tsx`) принимают `testid` и рендерят `data-testid={testid}`, а `TradeForm` передаёт `order-margin` и `order-liq-price`. Двухпаттерновый счёт их не видел, потому что `data-testid={testid}` — не литерал и не шаблон.

- [ ] **Step 4: Доказать, что страж срабатывает**

```bash
# временно ломаем один идентификатор
sed -i '' 's/data-testid="terminal-root"/data-testid="terminal-root-broken"/' src/features/terminal/Terminal.tsx
pnpm test -- testid-inventory   # Expected: FAIL — toContain("terminal-root") и снапшот
git checkout src/features/terminal/Terminal.tsx
pnpm test -- testid-inventory   # Expected: PASS
```

- [ ] **Step 5: Коммит**

```bash
git add src/__tests__
git commit -m "test(ui): инвентарь data-testid стоит стражем перед редизайном"
```

---

### Task 2: Alias `@/`, `components.json`, `cn`

**Files:**
- Modify: `vite.config.ts` (добавить `resolve.alias`)
- Modify: `vitest.config.ts` (добавить тот же `resolve.alias`)
- Modify: `tsconfig.app.json` (добавить `baseUrl` + `paths`)
- Create: `components.json`
- Create: `src/lib/utils.ts`
- Create: `src/lib/__tests__/utils.test.ts`
- Modify: `package.json` (зависимости)

**Interfaces:**
- Consumes: ничего.
- Produces: `cn(...inputs: ClassValue[]): string` из `@/lib/utils` — конкатенация классов с разрешением конфликтов Tailwind. Все следующие задачи импортируют примитивы как `@/components/ui/<name>`.

- [ ] **Step 1: Написать падающий тест на `cn`**

`src/lib/__tests__/utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { cn } from "../utils";

describe("cn", () => {
  it("отбрасывает ложные значения", () => {
    // Литералами, а не через `false && "b"`: ESLint справедливо зовёт такое
    // выражение мёртвым кодом, а под тестом здесь — что clsx отбрасывает ложное.
    expect(cn("a", false, undefined, null, "c")).toBe("a c");
  });

  it("разрешает конфликт tailwind-классов в пользу последнего", () => {
    // Именно это отличает cn от простой склейки: без tailwind-merge
    // результат был бы "p-2 p-4" и порядок решал бы CSS, а не вызов.
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
```

- [ ] **Step 2: Прогнать — тест падает**

Run: `pnpm test -- utils`
Expected: FAIL — `Failed to resolve import "../utils"`.

- [ ] **Step 3: Поставить зависимости**

```bash
pnpm add class-variance-authority clsx tailwind-merge lucide-react
pnpm add -D tw-animate-css
```

- [ ] **Step 4: Написать `cn`**

`src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Склейка классов с разрешением конфликтов Tailwind. Требуется каждым компонентом shadcn. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 5: Прогнать — тест проходит**

Run: `pnpm test -- utils`
Expected: PASS (2 теста).

- [ ] **Step 6: Прописать alias в Vite**

В `vite.config.ts` добавить импорт `import path from "node:path";` и внутрь возвращаемого объекта, рядом с `plugins`:

```ts
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
```

- [ ] **Step 7: Прописать alias в vitest**

`vitest.config.ts` — самостоятельный файл: он не читает `vite.config.ts`, поэтому alias из
шага 6 в тестах не действует. Дописать импорт `import path from "node:path";` и `resolve`
рядом с `test`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 8: Прописать alias в TypeScript**

В `tsconfig.app.json`, внутрь `compilerOptions`:

```json
    "paths": { "@/*": ["./src/*"] },
```

Без `baseUrl`: под TS 6 он снят и даёт `TS5101`. Пути и так разрешаются относительно
директории самого tsconfig — ровно то, что дал бы `baseUrl: "."`.

- [ ] **Step 9: Создать `components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

`tailwind.config` пуст намеренно: в v4 конфигурация живёт в CSS (`@theme inline` в `src/styles/index.css`).

- [ ] **Step 10: Проверить, что alias работает во всех трёх системах**

Перевести один существующий импорт на alias — в `src/features/terminal/Terminal.tsx` заменить
`import { Card } from "../../components/ui/Card";` на `import { Card } from "@/components/ui/Card";`

Заодно перевести на alias импорт в `src/lib/__tests__/utils.test.ts`: `import { cn } from "@/lib/utils";` — это и есть проверка третьей системы.

Run: `pnpm typecheck && pnpm build && pnpm test`
Expected: все три успешны. Падение `build` на неразрешённом `@/` значит, что alias прописан только в tsconfig — вернуться к шагу 6; падение `test` — что забыт шаг 7.

- [ ] **Step 11: Коммит**

```bash
git add vite.config.ts vitest.config.ts tsconfig.app.json components.json src/lib package.json pnpm-lock.yaml src/features/terminal/Terminal.tsx
git commit -m "build(ui): alias @/ и components.json — площадка под shadcn"
```

---

### Task 3: Палитра макета

Цвета сняты пипеткой с `monorepo/Trading_Flows/Frame.png`; проценты — доля кадра, они же объясняют роли.

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/index.css`
- Modify: `package.json` (шрифт)
- Create: `src/styles/__tests__/tokens.test.ts`

**Interfaces:**
- Consumes: ничего.
- Produces: токены `--bg --surface --surface-2 --border --text --muted --accent --long --short --long-soft --short-soft --radius --radius-sm --font`, доступные в Tailwind как `bg-bg`, `bg-surface`, `text-muted`, `border-border`, `text-long`, `text-short`, `bg-long-soft`, `bg-short-soft`.

- [ ] **Step 1: Написать падающий тест на связность токенов**

`src/styles/__tests__/tokens.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * `@theme inline` ссылается на переменные из tokens.css. Рассинхронизация не
 * ломает сборку — Tailwind молча отдаёт пустое значение, и цвет пропадает
 * только на экране. Тест ловит это до экрана.
 */
describe("токены", () => {
  const tokens = readFileSync("src/styles/tokens.css", "utf8");
  const theme = readFileSync("src/styles/index.css", "utf8");

  it("каждая переменная, на которую ссылается @theme, определена", () => {
    const referenced = [...theme.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]);
    expect(referenced.length).toBeGreaterThan(0);
    const missing = referenced.filter((name) => !tokens.includes(`${name}:`));
    expect(missing).toEqual([]);
  });

  it("несёт мягкие фоны сторон книги", () => {
    expect(tokens).toContain("--long-soft:");
    expect(tokens).toContain("--short-soft:");
  });

  it("шрифт, названный первым в стеке, приложение и правда везёт", () => {
    // Первый шрифт стека, доставшийся приложению случайно (он оказался у
    // пользователя в системе), — не выбор, а совпадение. Импорта пакета для
    // этого мало: имя семейства в токене должно совпасть с тем, которое пакет
    // объявляет. `@fontsource-variable/inter` объявляет `Inter Variable`, и
    // стек, начинающийся с `Inter`, до самохостящегося шрифта не доходит —
    // именно этот разрыв тест и стережёт.
    const SYSTEM = ["system-ui", "-apple-system", "sans-serif", "serif", "monospace"];
    const first = tokens.match(/--font:\s*"?([^",;]+)"?/)![1].trim();
    if (SYSTEM.includes(first)) return; // стек намеренно системный — везти нечего

    const imported = theme.match(/@import\s+"(@fontsource[^"]*)"/)?.[1];
    expect(
      imported,
      `стек начинается с «${first}», но ни один пакет шрифта не импортирован`,
    ).toBeDefined();

    const declared = [
      ...readFileSync(`node_modules/${imported}/index.css`, "utf8").matchAll(
        /font-family:\s*'([^']+)'/g,
      ),
    ].map((m) => m[1]);
    expect(declared).toContain(first);
  });
});
```

- [ ] **Step 2: Прогнать — тест падает**

Run: `pnpm test -- tokens`
Expected: FAIL — `--long-soft` не определён.

- [ ] **Step 3: Поставить шрифт макета**

Макет набран Inter. Стек, называющий шрифт, которого приложение не везёт, разрешается
только у тех, у кого Inter случайно стоит в системе, — у остальных молча падает в
`system-ui`. Пакет самохостится, внешнего запроса не делает, форкер снимает его одной строкой.

```bash
pnpm add @fontsource-variable/inter
```

- [ ] **Step 4: Записать палитру**

`src/styles/tokens.css` целиком:

```css
/*
 * Палитра снята с макета «Liqu — Trading Flows» (Frame.png) пипеткой.
 * Нейтральная намеренно: эталон форкают и перекрашивают, поэтому здесь нет
 * брендовых цветов Liqu (#8eed2e / #ed2472).
 */
:root {
  --bg: #070a0d;
  --surface: #11171c;
  --surface-2: #000000;
  --border: #20272d;
  --text: #f7f9fb;
  --muted: #8f9da9;
  --accent: #5aa6d2;
  --long: #3dbb6b;
  --short: #f0445a;
  /* Подложки строк стакана: тонированный фон, а не прозрачность поверх фона. */
  --long-soft: #0d1f18;
  --short-soft: #231116;
  --radius: 10px;
  --radius-sm: 6px;
  /* Именно `Inter Variable`: это семейство объявляет @fontsource-variable/inter. */
  --font: "Inter Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

- [ ] **Step 5: Расширить `@theme inline` и подключить шрифт**

В `src/styles/index.css` первой строкой, до `@import "tailwindcss";`:

```css
@import "@fontsource-variable/inter";
```

и внутрь блока `@theme inline`, к существующим строкам:

```css
  --color-long-soft: var(--long-soft);
  --color-short-soft: var(--short-soft);
```

- [ ] **Step 6: Прогнать тесты**

Run: `pnpm test -- tokens`
Expected: PASS (3 теста).

- [ ] **Step 7: Убедиться, что экран не сломан**

Run: `pnpm test:e2e`
Expected: 17 спек tier-1 зелёные. Цвета не участвуют в локаторах, поэтому падение здесь означает опечатку в CSS, а не смену палитры.

- [ ] **Step 8: Коммит**

```bash
git add src/styles package.json pnpm-lock.yaml
git commit -m "style(tokens): палитра снята с макета, а не с бренда Liqu"
```

---

### Task 4: `Button`, `Card`, `Input` на shadcn

**Files:**
- Modify: `tsconfig.json` (`paths` — чтобы CLI shadcn разрешил `@/`)
- Modify: `src/styles/index.css` (базовый цвет границы)
- Delete: `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/Input.tsx`
- Create: `src/components/ui/button.tsx`, `src/components/ui/card.tsx`, `src/components/ui/input.tsx` (ставит CLI)
- Modify: `src/components/ui/button.tsx` (словарь вариантов — терминала, не shadcn)
- Create: `src/components/ui/__tests__/vocabulary.test.ts`
- Modify: `src/components/ui/DecimalInput.tsx` (внутрь shadcn `Input`)
- Modify: `src/features/auth/SessionGate.tsx`, `src/features/wallet/ConnectButton.tsx`, `src/features/trade/TradeForm.tsx`, `src/features/trade/ConditionalFields.tsx`, `src/features/session-keys/SessionKeyModal.tsx`, `src/features/account/DepositDialog.tsx`, `src/features/account/WithdrawDialog.tsx`, `src/features/terminal/Terminal.tsx`, `src/features/userinfo/UserInfoTabs.tsx`

**Interfaces:**
- Consumes: `cn` из `@/lib/utils` (Task 2), токены (Task 3).
- Produces: `Button` с `variant: "default" | "long" | "short" | "ghost" | "outline" | "link"`, `Card`, `Input` из `@/components/ui/*`. `DecimalInput` сохраняет прежний API: `value`, `onValueChange`, `maxDecimals`, `invalid`, `rightSlot`.

- [ ] **Step 1: Убрать прежние примитивы до генерации**

Именно до, а не после: файловая система macOS нечувствительна к регистру, поэтому
`button.tsx` и `Button.tsx` — один и тот же путь, и CLI перезаписал бы старый файл, оставив
в индексе git запись под прежним именем.

```bash
git rm src/components/ui/Button.tsx src/components/ui/Card.tsx src/components/ui/Input.tsx
```

Дерево временно не собирается — девять файлов ссылаются на удалённое. Это ожидаемо: гейт
стоит в конце задачи.

- [ ] **Step 2: Дать CLI разрешить `@/`, потом поставить компоненты**

Корневой `tsconfig.json` в этом репозитории — solution-файл: `"files": []` плюс `references`.
CLI shadcn читает пути отсюда, ничего не находит и пишет компоненты в буквальную папку
`./@/components/ui/`. Дописать в него `compilerOptions` (на `tsc -b` не влияет — проверено):

```json
  "compilerOptions": { "paths": { "@/*": ["./src/*"] } },
```

```bash
pnpm dlx shadcn@latest add button card input
```

Проверить, что папки `./@` не появилось: `ls -d '@' 2>/dev/null` — пусто.

- [ ] **Step 3: Написать падающий тест на словарь токенов**

`src/components/ui/__tests__/vocabulary.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * shadcn генерирует компоненты под свой словарь токенов — `bg-primary`,
 * `text-foreground`, `ring-ring`, `border-input`. Терминал этого словаря не
 * заводит: у него собственный (`bg-accent`, `text-text`, `border-border`).
 * Утилита с неопределённым токеном сборку не ломает — Tailwind молча выдаёт
 * пустоту, и кнопка теряет фон только на экране. Ни страж инвентаря, ни
 * локаторы e2e цвета не проверяют, так что поймать это может только здесь.
 */
const FOREIGN = [
  "primary",
  "secondary",
  "destructive",
  "background",
  "foreground",
  "input",
  "popover",
  "card",
  "ring",
];

describe("примитивы shadcn", () => {
  const dir = "src/components/ui";

  it("говорят словарём терминала, а не своим", () => {
    const files = readdirSync(dir).filter((f) => f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      // Комментарии выбрасываем: правило должно быть можно объяснить прозой
      // рядом с кодом, назвав запрещённые имена, и не сломать этим само себя.
      const src = readFileSync(`${dir}/${file}`, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      for (const name of FOREIGN) {
        const hit = new RegExp(
          `(?:bg|text|border|ring|fill|stroke|from|to|via)-${name}\\b`,
        ).exec(src);
        if (hit) offenders.push(`${file}: ${hit[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("опираются на базовый цвет границы, и он задан", () => {
    // shadcn пишет голый `border`, ожидая базового слоя, который красит границы
    // по умолчанию. В Tailwind v4 без такого слоя голый `border` — это
    // `currentColor`, то есть почти белая линия цвета текста вместо #20272d.
    // Сборка при этом целая, и увидеть это можно только глазами.
    const emitsBareBorder = readdirSync(dir)
      .filter((f) => f.endsWith(".tsx"))
      .some((f) => /"[^"]*\bborder\b(?![-\w])/.test(readFileSync(`${dir}/${f}`, "utf8")));
    if (!emitsBareBorder) return;

    const theme = readFileSync("src/styles/index.css", "utf8");
    expect(theme).toMatch(/@layer\s+base[\s\S]*border-color/);
  });
});
```

- [ ] **Step 4: Прогнать — тест падает**

Run: `pnpm test -- vocabulary`
Expected: FAIL — список нарушителей из свежесгенерированных `button.tsx`, `card.tsx`,
`input.tsx` (`bg-primary`, `text-card-foreground`, `border-input`, `ring-ring` и подобные).
Выписать этот список: он и есть перечень мест, которые правит шаг 5.

- [ ] **Step 5: Перевести примитивы на словарь терминала**

В `button.tsx` заменить объект `variants.variant` в `buttonVariants` целиком на:

```ts
      variant: {
        // Прежний `primary` был умолчанием и красился в `bg-accent`: восемь
        // вызовов не передают variant вовсе, и подмена на shadcn-овский
        // `bg-primary` (токена с таким именем в теме нет) стёрла бы им фон.
        default: "bg-accent text-white hover:bg-accent/90",
        long: "bg-long text-[#06281d] hover:bg-long/90",
        short: "bg-short text-white hover:bg-short/90",
        // Вариант с этим именем есть и в shadcn, но выглядит иначе; молчаливая
        // подмена изменила бы вид трёх кнопок. Классы прежние, дословно.
        ghost: "bg-surface-2 text-muted border border-border hover:text-text",
        outline: "border border-border bg-transparent hover:bg-surface-2",
        link: "text-accent underline-offset-4 hover:underline",
      },
```

`secondary` и `destructive` не переносятся: ни один вызов их не просит.

В `card.tsx` у `Card` снять привнесённую раскладку и вернуть коробку прежней геометрии:

```ts
        "rounded-[var(--radius-card)] border bg-surface text-text",
```

Уходят `flex flex-col gap-6 py-6 shadow-sm` и `rounded-xl`. Прежний `Card` был голой
коробкой без мнений о раскладке, и оба вызова пользуются им именно так: `Terminal.tsx:18`
кладёт внутрь один чарт, `UserInfoTabs.tsx:23` — панель вкладок и таблицу, где `gap-6`
сложился бы с собственным `mb-2` панели. Раскладкой в shadcn заведуют `CardHeader` и
`CardContent`, которых здесь нет. Радиус — из токена макета, а не `xl`.

В `src/styles/index.css`, после блока `@theme inline`, добавить базовый слой:

```css
/*
 * shadcn пишет голый `border`, ожидая базового слоя. В Tailwind v4 умолчание —
 * `currentColor`, поэтому без этих трёх строк каждая карточка, каждый диалог и
 * каждая ручка панели чертят почти белую линию цвета текста вместо границы.
 */
@layer base {
  * {
    border-color: var(--border);
  }
}
```

Остальные нарушители из шага 4 — в базовых классах `button.tsx` и в `card.tsx` / `input.tsx`
— переводятся по словарю: `bg-background` → `bg-bg`, `bg-card` → `bg-surface`,
`text-card-foreground` / `text-foreground` → `text-text`, `text-muted-foreground` →
`text-muted`, `border-input` → `border-border`, `ring-ring` → `ring-accent`,
`bg-popover` → `bg-surface`. Кольцо фокуса переводится, а не выбрасывается: невидимое
кольцо — это потерянная доступность, а не косметика.

- [ ] **Step 6: Прогнать — тест проходит**

Run: `pnpm test -- vocabulary`
Expected: PASS.

- [ ] **Step 7: Перевести импорты**

Замены механические, по одной на файл:

| Файл | Было | Стало |
| --- | --- | --- |
| `features/auth/SessionGate.tsx` | `../../components/ui/Button` | `@/components/ui/button` |
| `features/wallet/ConnectButton.tsx` | `../../components/ui/Button` | `@/components/ui/button` |
| `features/trade/TradeForm.tsx` | `../../components/ui/Button` | `@/components/ui/button` |
| `features/session-keys/SessionKeyModal.tsx` | `../../components/ui/Button` | `@/components/ui/button` |
| `features/account/DepositDialog.tsx` | `../../components/ui/Button` | `@/components/ui/button` |
| `features/account/WithdrawDialog.tsx` | `../../components/ui/Button` | `@/components/ui/button` |
| `features/terminal/Terminal.tsx` | `@/components/ui/Card` | `@/components/ui/card` |
| `features/userinfo/UserInfoTabs.tsx` | `../../components/ui/Card` | `@/components/ui/card` |
| `features/trade/ConditionalFields.tsx` | `../../components/ui/Input` | `@/components/ui/input` |

Проверить, что ссылок не осталось:

```bash
grep -rn "ui/\(Button\|Card\|Input\)\"" src   # Expected: пусто
```

- [ ] **Step 8: Перевести `DecimalInput` на shadcn `Input`**

В `src/components/ui/DecimalInput.tsx` заменить голый `<input …>` на `<Input …>` из
`@/components/ui/input`, сохранив без изменений: `inputMode="decimal"`,
`autoComplete="off"`, `aria-invalid`, вызов `sanitizeDecimal(e.target.value, maxDecimals)`,
обёртку `relative flex items-center` и `rightSlot`. Классы состояния перевести на `cn`:

```tsx
        className={cn(
          invalid ? "border-short" : "border-border",
          rightSlot && "pr-16",
          className,
        )}
```

- [ ] **Step 9: Прогнать полный гейт**

Run: `pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm test:e2e`
Expected: всё зелёное, включая страж инвентаря из Task 1 и 113 тестов tier-1. Падение стража
означает, что при переносе импорта потерялся `data-testid` — искать в диффе.

- [ ] **Step 10: Коммит**

```bash
git add -A src/components src/features src/styles tsconfig.json package.json pnpm-lock.yaml
git commit -m "refactor(ui): три примитива уходят к shadcn, словарь токенов остаётся терминала"
```

---

### Task 5: `Dialog` на radix

Здесь меняется поведение, а не только вид: radix даёт focus trap, закрытие по Esc и `aria-modal`, которых у прежнего оверлея не было. Поэтому задача отделена от Task 4 — её можно отклонить, приняв предыдущую.

**Files:**
- Create: `src/components/ui/dialog.tsx` (ставит CLI)
- Delete: `src/components/ui/Dialog.tsx`
- Modify: `src/features/account/DepositDialog.tsx`, `src/features/account/WithdrawDialog.tsx`, `src/features/session-keys/SessionKeyModal.tsx`
- Create: `e2e/tier1/18-dialog-a11y.spec.ts`

**Interfaces:**
- Consumes: `Button` (Task 4).
- Produces: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogOverlay` из `@/components/ui/dialog`. `data-testid="dialog-overlay"` переезжает на `DialogOverlay`; `deposit-dialog`, `withdraw-dialog` остаются на прежних внутренних узлах.

- [ ] **Step 1: Написать падающий e2e-тест на новое поведение**

`e2e/tier1/18-dialog-a11y.spec.ts`:

```ts
import { AppPage } from "../pages/AppPage";
import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

test.describe("диалоги", () => {
  test("закрываются по Esc и объявляют себя модальными", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    await page.getByTestId("open-deposit-button").click();

    const dialog = page.getByTestId("deposit-dialog");
    await expect(dialog).toBeVisible();
    // Прежний оверлей был обычным div: скринридер не знал, что открыт модал.
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
```

- [ ] **Step 2: Прогнать — тест падает**

Run: `pnpm exec playwright test e2e/tier1/18-dialog-a11y.spec.ts`
Expected: FAIL — роли `dialog` нет, Esc ничего не закрывает.

- [ ] **Step 3: Поставить компонент**

```bash
pnpm dlx shadcn@latest add dialog
```

- [ ] **Step 4: Перевести `DepositDialog`**

Заменить обёртку. Было:

```tsx
    <Dialog open={open} onClose={onClose}>
      <div data-testid="deposit-dialog">
        <h3 className="mb-3 text-sm font-semibold">Deposit USDC</h3>
```

Стало:

```tsx
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        data-testid="deposit-dialog"
        overlayTestId="dialog-overlay"
        className="w-[320px]"
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Deposit USDC</DialogTitle>
        </DialogHeader>
```

Закрывающие теги — `</DialogContent></Dialog>`. Остальное содержимое диалога не трогать.

- [ ] **Step 5: Перевести `WithdrawDialog`**

Было (`src/features/account/WithdrawDialog.tsx:128`):

```tsx
    <Dialog open={open} onClose={onClose}>
      <div data-testid="withdraw-dialog">
        <h3 className="mb-3 text-sm font-semibold">Withdraw sUSDC</h3>
```

Стало:

```tsx
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        data-testid="withdraw-dialog"
        overlayTestId="dialog-overlay"
        className="w-[320px]"
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Withdraw sUSDC</DialogTitle>
        </DialogHeader>
```

Закрывающие теги — `</DialogContent></Dialog>`. Ветку долга (`hasDebt`) и все её testid не трогать.

- [ ] **Step 6: Перевести `SessionKeyModal`**

Модалка рисует свой fixed-оверлей, и её TSDoc утверждает «no Radix Dialog in the terminal» — утверждение перестаёт быть верным, поэтому меняются и код, и комментарий.

Было (`src/features/session-keys/SessionKeyModal.tsx:44`):

```tsx
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      data-testid="session-key-modal-overlay"
      onClick={onClose}
    >
      <div
        className="w-[360px] max-w-[calc(100vw-32px)] rounded-[var(--radius-card)] border border-border bg-surface p-4 text-text"
        onClick={(e) => e.stopPropagation()}
      >
```

Стало (`open` всегда `true` — открытым состоянием владеет `SessionKeyButton`, который просто не монтирует модалку в закрытом виде):

```tsx
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        overlayTestId="session-key-modal-overlay"
        showCloseButton={false}
        className="w-[360px] max-w-[calc(100vw-32px)]"
      >
```

Закрывающие теги — `</DialogContent></Dialog>`. Кнопку закрытия с `data-testid="session-key-modal-close"` **оставить своей**: у неё есть контракт, а встроенная кнопка shadcn его не несёт — отсюда `showCloseButton={false}`.

TSDoc переписать на: «Панель гранта сессионного ключа поверх shadcn `Dialog`. Открытым состоянием владеет `SessionKeyButton`.»

- [ ] **Step 7: Пробросить идентификатор оверлея**

Оверлеев в контракте два — `dialog-overlay` у денежных диалогов и `session-key-modal-overlay` у модалки ключа, — а `DialogContent` в shadcn рендерит `DialogOverlay` внутри себя. Значит идентификатор становится пропом с прежним значением по умолчанию.

В `src/components/ui/dialog.tsx`, в `DialogContent`:

```tsx
function DialogContent({
  className,
  children,
  overlayTestId = "dialog-overlay",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  /** Идентификатор оверлея. Умолчание — контракт денежных диалогов; модалка сессионного ключа передаёт свой. */
  overlayTestId?: string;
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay data-testid={overlayTestId} />
      {/* …сгенерированное тело Content без изменений… */}
```

Если в поставленной версии `showCloseButton` уже есть — оставить как есть и добавить только `overlayTestId`.

Оба денежных диалога передают `overlayTestId="dialog-overlay"` **явно**, не полагаясь на умолчание: инвентарь из Task 1 читает исходники, и идентификатор, живущий только в значении по умолчанию, читался бы как исчезнувший контракт.

- [ ] **Step 8: Удалить прежний Dialog**

```bash
git rm src/components/ui/Dialog.tsx
grep -rn "components/ui/Dialog\"" src   # Expected: пусто
```

- [ ] **Step 9: Прогнать полный гейт**

Run: `pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm test:e2e`
Expected: зелёное, включая новую спеку, прежнюю `03-deposit-withdraw` и **страж инвентаря без обновления снапшота** — задача переносит идентификаторы, а не заводит новые. Особое внимание — сценариям отмены и ожидания в `03`: закрытие теперь идёт через `onOpenChange`, и потерянный проброс проявится именно там.

- [ ] **Step 10: Коммит**

```bash
git add -A src/components src/features e2e
git commit -m "refactor(ui): диалоги переезжают на radix — фокус, Esc и роль modal"
```

---

### Task 6: Стор состояния экрана

**Files:**
- Create: `src/stores/useTerminalUiStore.ts`
- Create: `src/stores/__tests__/useTerminalUiStore.test.ts`

**Interfaces:**
- Consumes: ничего.
- Produces: `useTerminalUiStore` — `{ chartCollapsed: boolean; bottomFullscreen: boolean; toggleChart(): void; toggleBottomFullscreen(): void; reset(): void }`, персистится в `localStorage` под ключом `terminal-ui`.

Состояние экрана и только оно. Состояние тикета сюда не попадает: оно уже живёт в `useTradeStore` из `@liq/react`, и вторая копия разошлась бы с первой.

- [ ] **Step 1: Написать падающий тест**

`src/stores/__tests__/useTerminalUiStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";

import { useTerminalUiStore } from "../useTerminalUiStore";

describe("стор состояния экрана", () => {
  beforeEach(() => {
    useTerminalUiStore.getState().reset();
  });

  it("начинается с развёрнутого чарта и без фуллскрина", () => {
    expect(useTerminalUiStore.getState().chartCollapsed).toBe(false);
    expect(useTerminalUiStore.getState().bottomFullscreen).toBe(false);
  });

  it("переключает свёртку чарта", () => {
    useTerminalUiStore.getState().toggleChart();
    expect(useTerminalUiStore.getState().chartCollapsed).toBe(true);
    useTerminalUiStore.getState().toggleChart();
    expect(useTerminalUiStore.getState().chartCollapsed).toBe(false);
  });

  it("переключает фуллскрин нижней панели независимо от чарта", () => {
    useTerminalUiStore.getState().toggleBottomFullscreen();
    expect(useTerminalUiStore.getState().bottomFullscreen).toBe(true);
    expect(useTerminalUiStore.getState().chartCollapsed).toBe(false);
  });
});
```

- [ ] **Step 2: Прогнать — тест падает**

Run: `pnpm test -- useTerminalUiStore`
Expected: FAIL — модуля нет.

- [ ] **Step 3: Поставить zustand прямой зависимостью**

```bash
pnpm add zustand
```

Он уже приходит транзитивно с `@liq/react`, но опираться на чужую транзитивную зависимость нельзя: её мажорный подъём в SDK молча сменил бы API здесь.

- [ ] **Step 4: Написать стор**

`src/stores/useTerminalUiStore.ts`:

```ts
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface TerminalUiState {
  /** Свёрнут ли чарт — раскладка Frame-12. */
  chartCollapsed: boolean;
  /** Нижняя панель на весь экран — раскладка Frame-13. */
  bottomFullscreen: boolean;
}

interface TerminalUiActions {
  toggleChart: () => void;
  toggleBottomFullscreen: () => void;
  reset: () => void;
}

const INITIAL: TerminalUiState = {
  chartCollapsed: false,
  bottomFullscreen: false,
};

/**
 * Состояние экрана — то, чего нет и не должно быть в SDK: что свёрнуто, что
 * развёрнуто. Персистится, потому что раскладка терминала — настройка рабочего
 * места, а не сессии.
 *
 * @remarks Состояние ордера сюда не кладётся: им владеет `useTradeStore`
 * из `@liq/react`.
 */
export const useTerminalUiStore = create<TerminalUiState & TerminalUiActions>()(
  persist(
    (set) => ({
      ...INITIAL,
      toggleChart: () => set((s) => ({ chartCollapsed: !s.chartCollapsed })),
      toggleBottomFullscreen: () =>
        set((s) => ({ bottomFullscreen: !s.bottomFullscreen })),
      reset: () => set({ ...INITIAL }),
    }),
    { name: "terminal-ui", storage: createJSONStorage(() => localStorage) },
  ),
);
```

- [ ] **Step 5: Прогнать — тесты проходят**

Run: `pnpm test -- useTerminalUiStore`
Expected: PASS (3 теста). Если падает на `localStorage is not defined` — vitest работает в окружении `node`; заменить `createJSONStorage(() => localStorage)` на `createJSONStorage(() => (typeof localStorage === "undefined" ? { getItem: () => null, setItem: () => {}, removeItem: () => {} } : localStorage))` и объяснить это в TSDoc: браузерное хранилище отсутствует в тестовом окружении, а падать при импорте стор не должен.

- [ ] **Step 6: Коммит**

```bash
git add src/stores package.json pnpm-lock.yaml
git commit -m "feat(ui): состояние экрана живёт в своём сторе, состояние ордера — в SDK"
```

---

### Task 7: Оболочка на `Resizable`

Оболочка ставится последней: она переставляет узлы, и делать это стоит, когда примитивы и страж уже на месте. Колонка стакана в этой фазе **не появляется** — пустая панель была бы фикстурой на экране; она приходит в Ф1 вместе с данными.

**Files:**
- Create: `src/components/ui/resizable.tsx` (ставит CLI)
- Modify: `src/features/terminal/Terminal.tsx`
- Modify: `e2e/pages/TerminalPanels.ts` (page object для новых органов)
- Create: `e2e/tier1/19-layout.spec.ts`

**Interfaces:**
- Consumes: `useTerminalUiStore` (Task 6), `Card` (Task 4).
- Produces: раскладка с `data-testid`: `chart-panel`, `chart-collapse-toggle`, `bottom-panel`, `bottom-fullscreen-toggle`. `terminal-root` остаётся на корне.

- [ ] **Step 1: Написать падающий e2e-тест**

`e2e/tier1/19-layout.spec.ts`:

```ts
import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

test.describe("раскладка терминала", () => {
  test("чарт сворачивается и разворачивается", async ({ page, world }) => {
    await enterTerminal(page, world);
    await expect(page.getByTestId("chart-panel")).toBeVisible();

    await page.getByTestId("chart-collapse-toggle").click();
    await expect(page.getByTestId("chart-panel")).toBeHidden();

    await page.getByTestId("chart-collapse-toggle").click();
    await expect(page.getByTestId("chart-panel")).toBeVisible();
  });

  test("свёртка переживает перезагрузку", async ({ page, world }) => {
    await enterTerminal(page, world);
    await page.getByTestId("chart-collapse-toggle").click();
    await expect(page.getByTestId("chart-panel")).toBeHidden();

    await page.reload();
    // Раскладка — настройка рабочего места: она в persist-сторе, не в памяти.
    await expect(page.getByTestId("chart-panel")).toBeHidden();
  });

  test("нижняя панель разворачивается на весь экран", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    await page.getByTestId("bottom-fullscreen-toggle").click();
    await expect(page.getByTestId("bottom-panel")).toBeVisible();
    await expect(page.getByTestId("trade-form")).toBeHidden();
  });
});
```

- [ ] **Step 2: Прогнать — тест падает**

Run: `pnpm exec playwright test e2e/tier1/19-layout.spec.ts`
Expected: FAIL — `chart-panel` не найден. (`trade-form` в третьем тесте существует — `src/features/trade/TradeForm.tsx:191`.)

- [ ] **Step 3: Поставить компонент**

```bash
pnpm dlx shadcn@latest add resizable
```

CLI подтянет `react-resizable-panels`. Открыть сгенерированный `src/components/ui/resizable.tsx` и **прочитать, какие имена он экспортирует** (`ResizablePanelGroup` / `ResizablePanel` / `ResizableHandle` в текущих версиях) — библиотека меняла API между мажорами, и работать надо через то, что пришло, а не через то, что помнится.

- [ ] **Step 4: Переписать `Terminal.tsx`**

```tsx
import { PanelBottomClose, PanelBottomOpen, Maximize2, Minimize2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useTerminalUiStore } from "@/stores/useTerminalUiStore";

import { CandleChart } from "../chart/CandleChart";
import { MarketHeader } from "../market/MarketHeader";
import { useSelectedMarket } from "../market/useSelectedMarket";
import { TradeForm } from "../trade/TradeForm";
import { UserInfoTabs } from "../userinfo/UserInfoTabs";

export function Terminal() {
  const { marketId } = useSelectedMarket();
  const chartCollapsed = useTerminalUiStore((s) => s.chartCollapsed);
  const bottomFullscreen = useTerminalUiStore((s) => s.bottomFullscreen);
  const toggleChart = useTerminalUiStore((s) => s.toggleChart);
  const toggleBottomFullscreen = useTerminalUiStore(
    (s) => s.toggleBottomFullscreen,
  );

  return (
    <div className="flex flex-1 flex-col gap-3" data-testid="terminal-root">
      {!bottomFullscreen && <MarketHeader />}
      <ResizablePanelGroup direction="vertical" className="flex-1">
        {!bottomFullscreen && (
          <>
            <ResizablePanel defaultSize={55} minSize={25}>
              <ResizablePanelGroup direction="horizontal">
                <ResizablePanel defaultSize={70} minSize={40}>
                  <div className="flex h-full flex-col gap-2">
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={toggleChart}
                        data-testid="chart-collapse-toggle"
                        aria-label={chartCollapsed ? "Развернуть чарт" : "Свернуть чарт"}
                        className="text-muted hover:text-text"
                      >
                        {chartCollapsed ? (
                          <PanelBottomOpen size={16} />
                        ) : (
                          <PanelBottomClose size={16} />
                        )}
                      </button>
                    </div>
                    {!chartCollapsed && (
                      <Card className="flex-1 p-2" data-testid="chart-panel">
                        <CandleChart marketId={marketId} />
                      </Card>
                    )}
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={30} minSize={20}>
                  <TradeForm />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}
        <ResizablePanel defaultSize={bottomFullscreen ? 100 : 45} minSize={20}>
          <div className="flex h-full flex-col" data-testid="bottom-panel">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={toggleBottomFullscreen}
                data-testid="bottom-fullscreen-toggle"
                aria-label={bottomFullscreen ? "Свернуть панель" : "Развернуть панель"}
                className="text-muted hover:text-text"
              >
                {bottomFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
            <UserInfoTabs />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
```

- [ ] **Step 5: Расширить page object**

В `e2e/pages/TerminalPanels.ts` добавить класс рядом с `MarketHeaderPanel`:

```ts
export class LayoutPanel {
  readonly chartPanel: Locator;
  readonly chartCollapseToggle: Locator;
  readonly bottomPanel: Locator;
  readonly bottomFullscreenToggle: Locator;

  constructor(page: Page) {
    this.chartPanel = page.getByTestId("chart-panel");
    this.chartCollapseToggle = page.getByTestId("chart-collapse-toggle");
    this.bottomPanel = page.getByTestId("bottom-panel");
    this.bottomFullscreenToggle = page.getByTestId("bottom-fullscreen-toggle");
  }

  toggleChart(): Promise<void> {
    return this.chartCollapseToggle.click();
  }

  toggleBottomFullscreen(): Promise<void> {
    return this.bottomFullscreenToggle.click();
  }
}
```

- [ ] **Step 6: Прогнать новую спеку**

Run: `pnpm exec playwright test e2e/tier1/19-layout.spec.ts`
Expected: PASS (3 теста).

- [ ] **Step 7: Прогнать полный гейт**

Run: `pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build && pnpm test:e2e`
Expected: всё зелёное. Спека `02-market-data` ищет `canvas` — если она падает, чарт остался свёрнутым из персистентного состояния прошлого прогона; это дефект, а не флейк: убедиться, что дефолт `chartCollapsed: false` применяется при пустом хранилище.

- [ ] **Step 8: Обновить снапшот инвентаря**

Фаза добавила четыре идентификатора, и снапшот обязан это зафиксировать явно:

```bash
pnpm test -- testid-inventory -u
git diff src/__tests__/__snapshots__   # Expected: ровно +4 строки, ни одной удалённой
```

Удалённая строка в диффе означает потерянный контракт — вернуться и восстановить.

- [ ] **Step 9: Коммит**

```bash
git add -A src e2e
git commit -m "feat(ui): оболочка экрана на resizable — свёртка чарта и фуллскрин таблиц"
```

---

## Завершение фазы

- [ ] **Полный гейт:** `pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build && pnpm test:e2e`
- [ ] **Проверить, что контракт цел:** `git diff origin/main -- src/__tests__/__snapshots__` — только добавленные строки.
- [ ] **Draft-PR** в `liqu-fi/terminal`, база `main`:

```bash
gh pr create --draft --base main \
  --title "feat(ui): фундамент трейд-ядра — shadcn, палитра макета, оболочка экрана" \
  --body "$(cat <<'EOF'
## Что это

Ф0 спеки `docs/superpowers/specs/2026-09-01-trade-core-design.md`: терминал переезжает на
radix/shadcn, палитру макета и оболочку на resizable. Данных фаза не добавляет.

Здесь же уезжают два коммита апгрейда SDK до 0.42.0, оставшиеся вне `main`.

## Как проверено

- 17 спек tier-1 зелёные без правки локаторов — редизайн не изменил поведение
- страж инвентаря `data-testid` (снапшот) не потерял ни одной записи
- две новые спеки: роль modal и Esc у диалогов, свёртка чарта и фуллскрин панели

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01WxusndqpuksVMeVFAp6G68
EOF
)"
```
