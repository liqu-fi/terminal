# Вход через Turnkey — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в терминал вторую дверь входа — авторизацию Turnkey с торговлей со встроенного кошелька в TEE — не тронув существующий вход через `injected()`.

**Architecture:** `@liqpro/*@0.47` уже отдаёт коннектор, синтетический EIP-1193-провайдер, реестр провайдеров и полный sign-out, поэтому пишется только клей: урезанная до трёх шагов лестница личности (`resolve → connect → gas`) чистым редьюсером, два раннера без разметки, запомненная дверь с явным `reconnect` вместо `reconnectOnMount`, экран входа с двумя кнопками и обёртка над ручками долива газа.

**Tech Stack:** React 19, TypeScript 6, wagmi 2.19, viem 2.52, vitest 4 (`environment: "node"`), Playwright 1.60, `@liq/turnkey` / `@liq/react` / `@liq/core` 0.47.

**Spec:** `docs/superpowers/specs/2026-09-04-turnkey-login-design.md`

## Global Constraints

- Ветка: `feat-cld/turnkey-login`. Она уже создана, спека в ней закоммичена.
- Юнит-тесты только на **чистые функции**: `vitest.config.ts` задаёт `environment: "node"` и `include: ["src/**/*.test.ts"]` — файлы `.tsx` не подхватываются, RTL в репозитории нет. Компонент, который нельзя покрыть юнитом, покрывается e2e tier1.
- Язык комментариев и сообщений коммитов — русский, как во всём репозитории. Комментарий объясняет **почему**, а не пересказывает код.
- Флаг `VITE_TURNKEY_LOGIN` по умолчанию **выключен**. Все 29 существующих tier1-спек обязаны оставаться зелёными после каждой задачи.
- `data-testid` существующих элементов не переименовываются. Новые обязаны попасть в снапшот `src/__tests__/__snapshots__/testid-inventory.test.ts.snap`.
- Ручки шлюза (проверено на `https://staging.hype.cheap/v1` 2026-09-04): `GET /auth/gas-nonce` → `200` с конвертом `{"data":{"nonce":"…"},"meta":{…}}`; `POST /auth/gas` → `400` на пустое тело. Путь `/auth/gas-grant` из примера в доке `@liq/core` на шлюзе **отсутствует** (404) — не использовать.
- Идентификатор injected-коннектора wagmi — `"injected"`. Идентификатор коннектора Turnkey — константа `TURNKEY_CONNECTOR_ID` из `@liq/turnkey` (значение `"turnkey"`; импортировать константу, не литерал).
- Команды: `pnpm test <файл>` — юниты, `pnpm typecheck`, `pnpm lint`, `pnpm test:e2e <спек>` — e2e tier1.

---

### Task 1: Разведение флагов Turnkey в конфиге

Сегодня `env.turnkey.enabled` (`VITE_TURNKEY_SESSION`) отвечает и за бэкенд сессионных ключей, и за монтирование обёртки Turnkey. Вход нужен отдельным флагом, иначе включить его без сессионных ключей нельзя.

**Files:**
- Modify: `src/config/env.ts`
- Modify: `src/config/__tests__/env.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: ничего.
- Produces: `env.turnkey.login: boolean`; `env.turnkeyConfigError: string | null`; `turnkeyLoginEnabled: boolean` — все три читают задачи 3, 4, 8, 9.

- [ ] **Step 1: Написать падающие тесты**

Дописать в `src/config/__tests__/env.test.ts` (файл уже задаёт `afterEach` с `vi.unstubAllEnvs()` и `vi.resetModules()` — повторно его не добавлять):

```ts
describe("флаг входа через Turnkey", () => {
  const full = () => {
    vi.stubEnv("VITE_GATEWAY_URL", "https://gw.example.com/v1");
    vi.stubEnv("VITE_TURNKEY_ORG_ID", "org-1");
    vi.stubEnv("VITE_TURNKEY_AUTH_PROXY_CONFIG_ID", "cfg-1");
  };

  it("выключен по умолчанию и не жалуется на пустой конфиг", async () => {
    vi.stubEnv("VITE_GATEWAY_URL", "https://gw.example.com/v1");
    vi.resetModules();
    const { env, turnkeyLoginEnabled } = await import("../env");
    expect(env.turnkey.login).toBe(false);
    expect(env.turnkeyConfigError).toBeNull();
    expect(turnkeyLoginEnabled).toBe(false);
  });

  it("включается флагом при полном конфиге", async () => {
    full();
    vi.stubEnv("VITE_TURNKEY_LOGIN", "true");
    vi.resetModules();
    const { env, turnkeyLoginEnabled } = await import("../env");
    expect(env.turnkey.login).toBe(true);
    expect(env.turnkeyConfigError).toBeNull();
    expect(turnkeyLoginEnabled).toBe(true);
  });

  it("объясняет, чего не хватает, когда флаг включён без orgId", async () => {
    vi.stubEnv("VITE_GATEWAY_URL", "https://gw.example.com/v1");
    vi.stubEnv("VITE_TURNKEY_AUTH_PROXY_CONFIG_ID", "cfg-1");
    vi.stubEnv("VITE_TURNKEY_LOGIN", "true");
    vi.resetModules();
    const { env, turnkeyLoginEnabled } = await import("../env");
    expect(env.turnkeyConfigError).toMatch(/VITE_TURNKEY_ORG_ID/);
    expect(turnkeyLoginEnabled).toBe(false);
  });

  it("не трогает флаг сессионных ключей", async () => {
    full();
    vi.stubEnv("VITE_TURNKEY_LOGIN", "true");
    vi.resetModules();
    const { env } = await import("../env");
    expect(env.turnkey.enabled).toBe(false);
  });
});
```

- [ ] **Step 2: Прогнать тесты и убедиться, что падают**

Run: `pnpm test src/config/__tests__/env.test.ts`
Expected: FAIL — `env.turnkey.login` и `env.turnkeyConfigError` не существуют (`undefined`), `turnkeyLoginEnabled` не экспортируется.

- [ ] **Step 3: Реализовать**

В `src/config/env.ts` заменить объект `turnkey` и добавить проверку конфига. Комментарий над `turnkey` сохранить, дописав в него роль нового флага:

```ts
/**
 * Конфигурация Turnkey. Два независимых флага на один конфиг:
 *
 * - `enabled` (`VITE_TURNKEY_SESSION`) — бэкенд **сессионных ключей**: он
 *   выбирает ИСТОЧНИК ключа (анклав против ключа в localStorage), а не наличие
 *   сессии. Выключен — SDK возвращает кошельковый менеджер, 1-click работает
 *   без анклава.
 * - `login` (`VITE_TURNKEY_LOGIN`) — **дверь входа**: модалка Turnkey и
 *   встроенный кошелёк в TEE как подписант.
 *
 * Разведены, потому что это разные решения: вход через Turnkey полезен и без
 * сессионных ключей, а сессионные ключи работали до появления входа. Один флаг
 * на двоих означал бы, что включить одно нельзя, не включив другое.
 */
const turnkey = {
  enabled: import.meta.env.VITE_TURNKEY_SESSION === "true",
  login: import.meta.env.VITE_TURNKEY_LOGIN === "true",
  orgId: import.meta.env.VITE_TURNKEY_ORG_ID ?? "",
  authProxyUrl:
    import.meta.env.VITE_TURNKEY_AUTH_PROXY_URL ??
    "https://authproxy.turnkey.com",
  authProxyConfigId: import.meta.env.VITE_TURNKEY_AUTH_PROXY_CONFIG_ID ?? "",
};

/**
 * Чего не хватает включённой двери входа — или `null`, если всё на месте.
 *
 * @remarks Константа времени сборки, и это несущее свойство, а не деталь:
 * `useTurnkey()` бросает вне своего провайдера, поэтому компонент, который его
 * зовёт, обязан выйти ДО первого хука. Ветка, стоящая на константе, не меняется
 * за время монтирования — правило хуков соблюдено в обеих ветках.
 */
function readTurnkeyConfigError(): string | null {
  if (!turnkey.login) return null;
  const missing = [
    turnkey.orgId ? null : "VITE_TURNKEY_ORG_ID",
    turnkey.authProxyConfigId ? null : "VITE_TURNKEY_AUTH_PROXY_CONFIG_ID",
  ].filter((name): name is string => name !== null);
  if (missing.length === 0) return null;
  return `VITE_TURNKEY_LOGIN=true, но не задано: ${missing.join(", ")}. Вход через Turnkey выключен.`;
}
```

В объект `env` добавить `turnkeyConfigError: readTurnkeyConfigError(),` рядом с `turnkey`. После объявления `env` — экспорт производной константы:

```ts
/**
 * Показывать ли дверь Turnkey. Одно имя вместо повторения условия в четырёх
 * местах: разъехавшиеся копии этого условия — это экран, на котором кнопка
 * входа есть, а провайдера под ней нет.
 */
export const turnkeyLoginEnabled = env.turnkey.login && !env.turnkeyConfigError;
```

- [ ] **Step 4: Прогнать тесты**

Run: `pnpm test src/config/__tests__/env.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Обновить `.env.example`**

Заменить блок про Turnkey (комментарий про `VITE_WALLETCONNECT_PROJECT_ID` тоже поправить — он утверждает «wagmi is injected-only», что после задачи 3 перестанет быть безусловной правдой):

```dotenv
# Optional. Не коннектор wagmi: это WalletConnect ВНУТРИ Turnkey — вход
# подписью кошелька с телефона по QR. Оставьте пустым, и Turnkey всё равно
# пускает по коду на почту. Осмысленно вместе с любым из двух флагов ниже.
VITE_WALLETCONNECT_PROJECT_ID=

# Два независимых флага на один конфиг Turnkey.
#
# VITE_TURNKEY_SESSION — сессионные ключи (1-click). Выключен: каждый ордер
# подписывается попапом кошелька. Включён: подписывает анклав.
#
# VITE_TURNKEY_LOGIN — вход через Turnkey: код на почту или подпись внешнего
# кошелька, торговля со встроенного кошелька в TEE. Выключен: единственная
# дверь — расширение браузера, как раньше.
#
# Оба требуют org-id и auth-proxy-config-id из дашборда Turnkey (раздел
# Wallet Kit). Включённый VITE_TURNKEY_LOGIN без них гасит дверь и объясняет
# причину прямо на экране входа.
# VITE_TURNKEY_SESSION=true
# VITE_TURNKEY_LOGIN=true
# VITE_TURNKEY_ORG_ID=
# VITE_TURNKEY_AUTH_PROXY_CONFIG_ID=
# Optional override (defaults to Turnkey's hosted proxy):
# VITE_TURNKEY_AUTH_PROXY_URL=https://authproxy.turnkey.com
```

- [ ] **Step 6: Коммит**

```bash
git add src/config/env.ts src/config/__tests__/env.test.ts .env.example
git commit -m "feat(config): развести флаги Turnkey — вход отдельно от сессионных ключей"
```

---

### Task 2: Запомненная дверь и план восстановления

Чистые функции, вокруг которых строится вся защита из §2 спеки. Хранилище передаётся параметром: `environment: "node"` в vitest, глобального `localStorage` в тестах нет.

**Files:**
- Create: `src/features/auth/identityDoor.ts`
- Create: `src/features/auth/__tests__/identityDoor.test.ts`

**Interfaces:**
- Consumes: `TURNKEY_CONNECTOR_ID` из `@liq/turnkey`.
- Produces: `type IdentityDoor = "turnkey" | "injected"`; `INJECTED_CONNECTOR_ID`; `readDoor(storage)`; `writeDoor(storage, door)`; `clearDoor(storage)`; `reconnectPlan(door, connectorIds): string | null`. Их используют задачи 4 и 9.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/auth/__tests__/identityDoor.test.ts
import { TURNKEY_CONNECTOR_ID } from "@liq/turnkey";
import { describe, expect, it } from "vitest";

import {
  INJECTED_CONNECTOR_ID,
  clearDoor,
  readDoor,
  reconnectPlan,
  writeDoor,
} from "../identityDoor";

function memoryStorage(seed?: Record<string, string>) {
  const map = new Map(Object.entries(seed ?? {}));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

const BOTH = [INJECTED_CONNECTOR_ID, TURNKEY_CONNECTOR_ID];

describe("readDoor", () => {
  it("возвращает null, когда ничего не записано", () => {
    expect(readDoor(memoryStorage())).toBeNull();
  });

  it("читает записанную дверь", () => {
    const storage = memoryStorage();
    writeDoor(storage, "turnkey");
    expect(readDoor(storage)).toBe("turnkey");
  });

  it("не пропускает мусор наружу", () => {
    const storage = memoryStorage({ "liq-terminal-door": "metamask" });
    expect(readDoor(storage)).toBeNull();
  });

  it("переживает хранилище, которое бросает", () => {
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(readDoor(throwing)).toBeNull();
  });

  it("clearDoor стирает запись", () => {
    const storage = memoryStorage();
    writeDoor(storage, "injected");
    clearDoor(storage);
    expect(readDoor(storage)).toBeNull();
  });
});

describe("reconnectPlan", () => {
  it("без запомненной двери не восстанавливает ничего", () => {
    expect(reconnectPlan(null, BOTH)).toBeNull();
  });

  it("восстанавливает ровно ту дверь, которой входили", () => {
    expect(reconnectPlan("injected", BOTH)).toBe(INJECTED_CONNECTOR_ID);
    expect(reconnectPlan("turnkey", BOTH)).toBe(TURNKEY_CONNECTOR_ID);
  });

  it("молчит, когда коннектора двери нет в сборке", () => {
    expect(reconnectPlan("turnkey", [INJECTED_CONNECTOR_ID])).toBeNull();
  });
});
```

- [ ] **Step 2: Прогнать и убедиться, что падает**

Run: `pnpm test src/features/auth/__tests__/identityDoor.test.ts`
Expected: FAIL — модуль `../identityDoor` не найден.

- [ ] **Step 3: Реализовать**

```ts
// src/features/auth/identityDoor.ts
import { TURNKEY_CONNECTOR_ID } from "@liq/turnkey";

/** Идентификатор injected-коннектора wagmi. */
export const INJECTED_CONNECTOR_ID = "injected";

export const DOOR_STORAGE_KEY = "liq-terminal-door";

/** Дверь, которой вошли: расширение браузера или Turnkey. */
export type IdentityDoor = "turnkey" | "injected";

/**
 * Зачем дверь вообще запоминается.
 *
 * @remarks
 * `reconnect()` в wagmi перебирает ВСЕ коннекторы, отсортированные по свежести,
 * и подключает первый авторизованный. После входа через Turnkey подписью
 * внешнего кошелька расширение уже выдало разрешение этому origin, а коннектор
 * Turnkey на перезагрузке ещё пуст — значит первым авторизованным окажется
 * injected, и терминал поднимется под адресом EOA вместо встроенного кошелька.
 * Пользователю предложат создать аккаунт, которого у этого адреса нет.
 *
 * Отсюда вся конструкция: восстанавливаем не «что найдётся», а ровно ту дверь,
 * которой входили.
 */
export function readDoor(storage: Pick<Storage, "getItem">): IdentityDoor | null {
  let raw: string | null;
  try {
    raw = storage.getItem(DOOR_STORAGE_KEY);
  } catch {
    // Приватное окно и заблокированные site data бросают на самом обращении.
    // Забыть дверь — это потерянный автоконнект, а не сломанный вход.
    return null;
  }
  return raw === "turnkey" || raw === "injected" ? raw : null;
}

export function writeDoor(
  storage: Pick<Storage, "setItem">,
  door: IdentityDoor,
): void {
  try {
    storage.setItem(DOOR_STORAGE_KEY, door);
  } catch {
    /* см. readDoor */
  }
}

export function clearDoor(storage: Pick<Storage, "removeItem">): void {
  try {
    storage.removeItem(DOOR_STORAGE_KEY);
  } catch {
    /* см. readDoor */
  }
}

/**
 * Какой коннектор восстанавливать на старте.
 *
 * @returns id коннектора либо `null` — «не восстанавливать ничего».
 * `null` при отсутствующем коннекторе, а не падение: дверь могла быть записана
 * сборкой с включённым флагом входа, а открыта сборкой с выключенным.
 */
export function reconnectPlan(
  door: IdentityDoor | null,
  connectorIds: readonly string[],
): string | null {
  if (!door) return null;
  const wanted = door === "turnkey" ? TURNKEY_CONNECTOR_ID : INJECTED_CONNECTOR_ID;
  return connectorIds.includes(wanted) ? wanted : null;
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `pnpm test src/features/auth/__tests__/identityDoor.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/features/auth/identityDoor.ts src/features/auth/__tests__/identityDoor.test.ts
git commit -m "feat(auth): запоминать дверь входа и планировать восстановление по ней"
```

---

### Task 3: Коннектор Turnkey в конфиге wagmi

**Files:**
- Modify: `src/config/chain.ts`
- Modify: `src/features/wallet/ConnectButton.tsx`
- Create: `src/config/__tests__/chain.test.ts`

**Interfaces:**
- Consumes: `turnkeyLoginEnabled` (задача 1), `INJECTED_CONNECTOR_ID` (задача 2).
- Produces: `getConfig()` с двумя коннекторами при включённом флаге; `ConnectButton` выбирает коннектор по id.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/config/__tests__/chain.test.ts
import { TURNKEY_CONNECTOR_ID } from "@liq/turnkey";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function connectorIds(): Promise<string[]> {
  const { getConfig } = await import("../chain");
  return getConfig().connectors.map((c) => c.id);
}

describe("коннекторы wagmi", () => {
  it("без флага входа — только injected", async () => {
    vi.stubEnv("VITE_GATEWAY_URL", "https://gw.example.com/v1");
    vi.resetModules();
    expect(await connectorIds()).toEqual(["injected"]);
  });

  it("с флагом входа — injected первым, Turnkey вторым", async () => {
    vi.stubEnv("VITE_GATEWAY_URL", "https://gw.example.com/v1");
    vi.stubEnv("VITE_TURNKEY_LOGIN", "true");
    vi.stubEnv("VITE_TURNKEY_ORG_ID", "org-1");
    vi.stubEnv("VITE_TURNKEY_AUTH_PROXY_CONFIG_ID", "cfg-1");
    vi.resetModules();
    expect(await connectorIds()).toEqual(["injected", TURNKEY_CONNECTOR_ID]);
  });

});
```

`multiInjectedProviderDiscovery: false` тестом не покрывается намеренно: wagmi создаёт хранилище MIPD только при `typeof window !== "undefined"` (`createConfig.js:18`), а vitest здесь в `environment: "node"` — проверка проходила бы одинаково при любом значении флага, то есть врала бы. Флаг сторожит комментарий в коде и ручная проверка перед PR.

- [ ] **Step 2: Прогнать и убедиться, что падает**

Run: `pnpm test src/config/__tests__/chain.test.ts`
Expected: FAIL — второй тест видит `["injected"]`, третий видит объект MIPD.

- [ ] **Step 3: Реализовать конфиг**

В `src/config/chain.ts` заменить импорты и `getConfig()`; существующий комментарий про единственного владельца WalletConnect сохранить, дополнив:

```ts
import { turnkeyConnector } from "@liq/turnkey";
import { defineChain } from "viem";
import { createConfig, http, type Config } from "wagmi";
import { injected } from "wagmi/connectors";

import { env, turnkeyLoginEnabled } from "./env";
```

```ts
/**
 * @remarks
 * Две двери — два коннектора, и порядок в списке значения не имеет: и
 * `ConnectButton`, и восстановление сессии ищут коннектор ПО ID
 * (`reconnectPlan`), а не по индексу. Раньше кнопка брала `connectors[0]` и
 * работала лишь потому, что коннектор был ровно один.
 *
 * `multiInjectedProviderDiscovery: false` — не оптимизация. По умолчанию wagmi
 * добавляет коннектор на КАЖДЫЙ кошелёк, объявившийся по EIP-6963 (MetaMask,
 * Rabby, Phantom, TronLink…), и «первый авторизованный» в `reconnect()`
 * становится лотереей, в которой встроенный кошелёк Turnkey заведомо
 * проигрывает — его провайдер на старте ещё пуст. Выключенным флагом wagmi
 * заодно перестаёт опрашивать `eth_accounts` у каждого расширения на загрузке.
 *
 * Коннектора `walletConnect()` здесь по-прежнему нет: стек WalletConnect
 * принадлежит `TurnkeyProviderWrapper` на том же project id, а две Core на
 * странице делят clientId через localStorage и дерутся за единственное
 * разрешённое каждой соединение с релеем. Коннектор wagmi к тому же определяет
 * `setup()`, который жадно поднимает `EthereumProvider.init()` во время
 * `createConfig()` — сокет к релею открывался на каждой загрузке страницы даже
 * тем, кто кошелька не касался.
 */
export function getConfig(): Config {
  return createConfig({
    chains: [megaethTestnet],
    connectors: turnkeyLoginEnabled
      ? [injected(), turnkeyConnector()]
      : [injected()],
    multiInjectedProviderDiscovery: false,
    transports: { [megaethTestnet.id]: http(env.rpcUrl) },
  });
}
```

- [ ] **Step 4: Реализовать выбор коннектора по id**

В `src/features/wallet/ConnectButton.tsx` заменить блок выбора коннектора (комментарий про `connectors[0]` уходит вместе с кодом):

```tsx
import { INJECTED_CONNECTOR_ID } from "../auth/identityDoor";
```

```tsx
  // По id, а не по индексу: с появлением двери Turnkey в конфиге два
  // коннектора, и `connectors[0]` подключал бы то, что раньше стоит в списке.
  const connector = connectors.find((c) => c.id === INJECTED_CONNECTOR_ID);
```

- [ ] **Step 5: Прогнать тесты**

Run: `pnpm test src/config/__tests__/chain.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Прогнать e2e онбординга — старая дверь не должна пострадать**

Run: `pnpm test:e2e e2e/tier1/01-onboarding.spec.ts e2e/tier1/13-disconnect.spec.ts`
Expected: PASS.

- [ ] **Step 7: Коммит**

```bash
git add src/config/chain.ts src/config/__tests__/chain.test.ts src/features/wallet/ConnectButton.tsx
git commit -m "feat(wallet): коннектор Turnkey рядом с injected, выбор по id"
```

---

### Task 4: Явное восстановление сессии по запомненной двери

Самая рискованная задача плана: она выключает `reconnectOnMount` и берёт восстановление на себя. Поэтому запись двери для injected входит сюда же — иначе после этого коммита дверь никто не пишет, `reconnectPlan` всегда возвращает `null`, и `15-session-persistence` падает.

**Files:**
- Create: `src/features/auth/IdentityDoorProvider.tsx`
- Modify: `src/providers/AppProviders.tsx`
- Modify: `src/features/wallet/ConnectButton.tsx`
- Modify: `src/features/auth/SessionGate.tsx`

**Interfaces:**
- Consumes: `readDoor`, `writeDoor`, `clearDoor`, `reconnectPlan`, `INJECTED_CONNECTOR_ID` (задача 2).
- Produces: `useIdentityDoor(): { door: IdentityDoor | null; booting: boolean; setDoor(door): void; forgetDoor(): void }` — читают задачи 8 и 9.

- [ ] **Step 1: Написать провайдер**

```tsx
// src/features/auth/IdentityDoorProvider.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useConfig, useReconnect } from "wagmi";

import {
  clearDoor,
  readDoor,
  reconnectPlan,
  writeDoor,
  type IdentityDoor,
} from "./identityDoor";

export type IdentityDoorValue = {
  /** Дверь, которой вошли в этой вкладке, либо `null`. */
  door: IdentityDoor | null;
  /** Восстановление сессии ещё идёт: показывать загрузку, а не экран входа. */
  booting: boolean;
  setDoor: (door: IdentityDoor) => void;
  forgetDoor: () => void;
};

const IdentityDoorContext = createContext<IdentityDoorValue | null>(null);

/** Читает дверь сессии. Бросает вне `<IdentityDoorProvider>`. */
export function useIdentityDoor(): IdentityDoorValue {
  const value = useContext(IdentityDoorContext);
  if (!value) {
    throw new Error(
      "useIdentityDoor: только внутри <IdentityDoorProvider>",
    );
  }
  return value;
}

/**
 * Владелец запомненной двери и восстановления сессии.
 *
 * @remarks
 * Монтируется прямо под `<WagmiProvider>` и БЕЗУСЛОВНО — не внутри обёртки
 * Turnkey. Обёртка поднимается только при своём конфиге, и провайдер внутри неё
 * оставил бы сборку с выключенной дверью Turnkey вообще без восстановления
 * сессии: перезагрузка выбрасывала бы на экран входа всех, включая тех, кто
 * входит расширением.
 *
 * `reconnectOnMount` у `<WagmiProvider>` выключен именно ради этого компонента:
 * штатное восстановление wagmi перебирает все коннекторы и берёт первый
 * авторизованный — см. `identityDoor.ts` о том, почему это подключает не ту
 * личность.
 */
export function IdentityDoorProvider({ children }: { children: ReactNode }) {
  const config = useConfig();
  const { reconnect } = useReconnect();
  const [door, setDoorState] = useState<IdentityDoor | null>(() =>
    readDoor(window.localStorage),
  );
  // Дверь есть — значит восстанавливать что-то будем, и до его завершения
  // экран входа показывать нельзя. Двери нет — грузиться нечему.
  const [booting, setBooting] = useState(() => door !== null);
  const started = useRef(false);

  useEffect(() => {
    // Ровно один запуск на монтирование: StrictMode прогоняет setup дважды, а
    // `reconnect()` не идемпотентен по смыслу — второй вызов wagmi отбивает
    // своим внутренним флагом, но его резолв сбросил бы `booting` раньше срока.
    if (started.current) return;
    started.current = true;
    const plan = reconnectPlan(door, config.connectors.map((c) => c.id));
    if (!plan) {
      setBooting(false);
      return;
    }
    const connector = config.connectors.find((c) => c.id === plan);
    if (!connector) {
      setBooting(false);
      return;
    }
    reconnect(
      { connectors: [connector] },
      { onSettled: () => setBooting(false) },
    );
  }, [door, config, reconnect]);

  const setDoor = useCallback((next: IdentityDoor) => {
    writeDoor(window.localStorage, next);
    setDoorState(next);
  }, []);

  const forgetDoor = useCallback(() => {
    clearDoor(window.localStorage);
    setDoorState(null);
  }, []);

  const value = useMemo<IdentityDoorValue>(
    () => ({ door, booting, setDoor, forgetDoor }),
    [door, booting, setDoor, forgetDoor],
  );

  return (
    <IdentityDoorContext.Provider value={value}>
      {children}
    </IdentityDoorContext.Provider>
  );
}
```

- [ ] **Step 2: Смонтировать провайдер и выключить штатное восстановление**

`src/providers/AppProviders.tsx` целиком:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";

import { getConfig } from "../config/chain";
import { IdentityDoorProvider } from "../features/auth/IdentityDoorProvider";
import { LiqSetup } from "./LiqSetup";

const queryClient = new QueryClient();
const wagmiConfig = getConfig();

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* reconnectOnMount выключен: восстановлением владеет
          IdentityDoorProvider — он поднимает ровно ту дверь, которой входили,
          а не первый авторизованный коннектор. */}
      <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
        <IdentityDoorProvider>
          <LiqSetup>{children}</LiqSetup>
        </IdentityDoorProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Писать и стирать дверь в `ConnectButton`**

В `src/features/wallet/ConnectButton.tsx` добавить импорт (хук живёт в файле провайдера, не в `identityDoor.ts`):

```tsx
import { useIdentityDoor } from "../auth/IdentityDoorProvider";
```

взять из него две команды:

```tsx
  const { setDoor, forgetDoor } = useIdentityDoor();
```

Отключение:

```tsx
      <button
        onClick={() => {
          forgetDoor();
          disconnect();
        }}
```

Подключение:

```tsx
      onClick={() =>
        connector &&
        connect(
          { connector },
          // Дверь пишется по факту подключения, а не по клику: отменённый в
          // расширении коннект не должен оставлять после себя дверь, которую
          // следующая загрузка попробует восстановить.
          { onSuccess: () => setDoor("injected") },
        )
      }
```

- [ ] **Step 4: Не моргать экраном входа на перезагрузке**

В `src/features/auth/SessionGate.tsx`, в начале `SessionGateInner`, до вычисления ступени:

```tsx
  const { booting } = useIdentityDoor();
```

и сразу после вычисления `stage`:

```tsx
  // Пока идёт восстановление, wagmi отвечает `disconnected`, и без этой ветки
  // гейт показывал бы экран входа кадром на каждой перезагрузке. Раньше ту же
  // роль играл `isReconnecting` внутри штатного восстановления wagmi.
  if (booting) {
    return (
      <Centered testid="session-loading">
        <p className="text-muted">Loading account…</p>
      </Centered>
    );
  }
```

- [ ] **Step 5: Прогнать типы и линт**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Прогнать e2e, которые стерегут восстановление**

Run: `pnpm test:e2e e2e/tier1/01-onboarding.spec.ts e2e/tier1/13-disconnect.spec.ts e2e/tier1/15-session-persistence.spec.ts`
Expected: PASS. Именно `15-session-persistence` доказывает, что перезагрузка возвращает в терминал без второго SIWE, — это единственная проверка выключенного `reconnectOnMount`.

- [ ] **Step 7: Коммит**

```bash
git add src/features/auth/IdentityDoorProvider.tsx src/providers/AppProviders.tsx src/features/wallet/ConnectButton.tsx src/features/auth/SessionGate.tsx
git commit -m "feat(auth): восстанавливать сессию по запомненной двери, а не первым авторизованным коннектором"
```

---

### Task 5: Методы модалки Turnkey

**Files:**
- Create: `src/features/auth/turnkeyAuthMethods.ts`
- Create: `src/features/auth/__tests__/turnkeyAuthMethods.test.ts`

**Interfaces:**
- Consumes: типы `TurnkeyAuthMethods`, `TurnkeyAuthMethodOrder` из `@liq/react`.
- Produces: `turnkeyAuthMethods(): { methods: TurnkeyAuthMethods; methodOrder: TurnkeyAuthMethodOrder }` — читает задача 8.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/auth/__tests__/turnkeyAuthMethods.test.ts
import { describe, expect, it } from "vitest";

import { turnkeyAuthMethods } from "../turnkeyAuthMethods";

describe("turnkeyAuthMethods", () => {
  it("открывает ровно две двери: почту и внешний кошелёк", () => {
    const { methods } = turnkeyAuthMethods();
    expect(methods.emailOtpAuthEnabled).toBe(true);
    expect(methods.walletAuthEnabled).toBe(true);
  });

  it("перечисляет каждый флаг явно, не полагаясь на дашборд", () => {
    const { methods } = turnkeyAuthMethods();
    // Пропущенный ключ провайдер разрешает против `enabledProviders` из
    // дашборда — то есть молча включает то, что там включено.
    expect(Object.keys(methods).sort()).toEqual(
      [
        "appleOauthEnabled",
        "discordOauthEnabled",
        "emailOtpAuthEnabled",
        "facebookOauthEnabled",
        "googleOauthEnabled",
        "passkeyAuthEnabled",
        "smsOtpAuthEnabled",
        "walletAuthEnabled",
        "xOauthEnabled",
      ].sort(),
    );
  });

  it("выключает всё остальное", () => {
    const { methods } = turnkeyAuthMethods();
    expect(methods.smsOtpAuthEnabled).toBe(false);
    expect(methods.passkeyAuthEnabled).toBe(false);
    expect(methods.googleOauthEnabled).toBe(false);
    expect(methods.appleOauthEnabled).toBe(false);
    expect(methods.xOauthEnabled).toBe(false);
    expect(methods.discordOauthEnabled).toBe(false);
    expect(methods.facebookOauthEnabled).toBe(false);
  });

  it("ставит почту первой", () => {
    expect(turnkeyAuthMethods().methodOrder).toEqual(["email", "wallet"]);
  });
});
```

- [ ] **Step 2: Прогнать и убедиться, что падает**

Run: `pnpm test src/features/auth/__tests__/turnkeyAuthMethods.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать**

```ts
// src/features/auth/turnkeyAuthMethods.ts
import type { TurnkeyAuthMethodOrder, TurnkeyAuthMethods } from "@liq/react";

/**
 * Конфигурация модалки Turnkey: две двери внутрь.
 *
 * @remarks
 * Код на почту и подпись внешнего кошелька — это два способа доказать личность
 * Turnkey, и только. Обе приводят к одному подписанту: `provisionEmbeddedWallet`
 * кладёт `customWallet` и в `createSuborgParams.emailOtpAuth`, и в `.walletAuth`,
 * так что встроенный кошелёк в TEE есть у суб-организации независимо от того,
 * какой дверью пользователь вошёл. Выбор заканчивается вместе с модалкой — нести
 * его дальше в состояние приложения незачем.
 *
 * Каждый флаг перечислен явно, а не оставлен на умолчания: отсутствующий ключ
 * провайдер разрешает против `enabledProviders` из дашборда, то есть пропуск
 * молча включает то, что включено там. На `walletConfig.chains` этот же класс
 * ошибки уже случался — отсутствующий ключ означал «включено».
 *
 * Вход кошельком НЕ зависит от `VITE_WALLETCONNECT_PROJECT_ID`, хотя
 * `TurnkeyProviderWrapper` строит вокруг него свой `walletConfig`:
 * `TurnkeyProvider` перезаписывает `walletConfig.features.auth` значением
 * `walletAuthEnabled`, а `chains.ethereum.native` включён в обеих ветках
 * обёртки — штамп кошелька собирается и расширения EIP-6963 находятся в любом
 * случае. Project id покупает только сам WalletConnect, то есть мобильные
 * кошельки по QR.
 */
export function turnkeyAuthMethods(): {
  methods: TurnkeyAuthMethods;
  methodOrder: TurnkeyAuthMethodOrder;
} {
  return {
    methods: {
      emailOtpAuthEnabled: true,
      walletAuthEnabled: true,
      smsOtpAuthEnabled: false,
      passkeyAuthEnabled: false,
      googleOauthEnabled: false,
      appleOauthEnabled: false,
      xOauthEnabled: false,
      discordOauthEnabled: false,
      facebookOauthEnabled: false,
    },
    methodOrder: ["email", "wallet"],
  };
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `pnpm test src/features/auth/__tests__/turnkeyAuthMethods.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/features/auth/turnkeyAuthMethods.ts src/features/auth/__tests__/turnkeyAuthMethods.test.ts
git commit -m "feat(auth): конфигурация модалки Turnkey — почта и внешний кошелёк"
```

---

### Task 6: Обёртка над ручками долива газа

Свежий встроенный кошелёк пуст, а `createAccount` — первая ончейн-запись. Без газа она падает.

**Files:**
- Create: `src/features/wallet/gasGrant.ts`
- Create: `src/features/wallet/__tests__/gasGrant.test.ts`

**Interfaces:**
- Consumes: `gasGrantMessage`, `asGasGrantReason`, `type GasGrantReason` из `@liq/core`.
- Produces: `type GasGrantOutcome`; `requestGasGrant(input): Promise<GasGrantOutcome>` — используют задачи 7 (тип) и 8 (вызов).

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/wallet/__tests__/gasGrant.test.ts
import { gasGrantMessage } from "@liq/core";
import { describe, expect, it, vi } from "vitest";

import { requestGasGrant } from "../gasGrant";

const GATEWAY = "https://gw.example.com/v1";
const ADDRESS = "0x1111111111111111111111111111111111111111" as const;
const SIG = "0xdead" as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function call(fetchImpl: typeof fetch, signMessage = vi.fn().mockResolvedValue(SIG)) {
  return requestGasGrant({
    gatewayUrl: GATEWAY,
    address: ADDRESS,
    subOrgId: "sub-1",
    signMessage,
    fetchImpl,
  });
}

describe("requestGasGrant", () => {
  it("подписывает нонс из конверта и возвращает исход шлюза", async () => {
    const signMessage = vi.fn().mockResolvedValue(SIG);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { nonce: "n1" }, meta: {} }))
      .mockResolvedValueOnce(jsonResponse({ data: { funded: true }, meta: {} }));

    await expect(call(fetchImpl as unknown as typeof fetch, signMessage)).resolves.toEqual({
      funded: true,
      reason: undefined,
    });
    expect(signMessage).toHaveBeenCalledWith({ message: gasGrantMessage("n1") });
    expect(fetchImpl.mock.calls[0][0]).toBe(`${GATEWAY}/auth/gas-nonce`);
    expect(fetchImpl.mock.calls[1][0]).toBe(`${GATEWAY}/auth/gas`);
  });

  it("принимает и голое тело без конверта", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ nonce: "n1" }))
      .mockResolvedValueOnce(jsonResponse({ funded: false, reason: "ALREADY_FUNDED" }));

    await expect(call(fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      funded: false,
      reason: "ALREADY_FUNDED",
    });
  });

  it("на деплое без этих ручек отвечает HTTP_ERROR со статусом, а не ошибкой разбора", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    await expect(call(fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      funded: false,
      reason: "HTTP_ERROR",
      status: 404,
    });
  });

  it("429 — это RATE_LIMITED, а не сбой", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
    await expect(call(fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      funded: false,
      reason: "RATE_LIMITED",
      status: 429,
    });
  });

  it("рабочий статус с неразбираемым телом — BAD_RESPONSE", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("не json", { status: 200 }));
    await expect(call(fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      funded: false,
      reason: "BAD_RESPONSE",
    });
  });

  it("оборванная связь — NETWORK", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(call(fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      funded: false,
      reason: "NETWORK",
    });
  });

  it("отказ подписанта не выдаётся за сетевую ошибку", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { nonce: "n1" }, meta: {} }));
    const signMessage = vi.fn().mockRejectedValue(new Error("TEE отказал"));
    await expect(
      call(fetchImpl as unknown as typeof fetch, signMessage),
    ).resolves.toEqual({ funded: false, reason: "SIGN_FAILED" });
  });

  it("неизвестную причину от шлюза приводит к UNKNOWN", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { nonce: "n1" }, meta: {} }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { funded: false, reason: "НОВОЕ" }, meta: {} }),
      );
    await expect(call(fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      funded: false,
      reason: "UNKNOWN",
    });
  });
});
```

- [ ] **Step 2: Прогнать и убедиться, что падает**

Run: `pnpm test src/features/wallet/__tests__/gasGrant.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать**

```ts
// src/features/wallet/gasGrant.ts
import { asGasGrantReason, gasGrantMessage, type GasGrantReason } from "@liq/core";

/**
 * Причины, которых нет в перечислении SDK.
 *
 * @remarks
 * SDK знает пять отказов самого шлюза плюс `USER_REJECTED`, `NETWORK` и
 * `UNKNOWN`. Три причины ниже он не покрывает, и сворачивать их в `UNKNOWN`
 * значит терять того, к кому вопрос:
 *
 * - `HTTP_ERROR` — шлюз ответил кодом ошибки, то есть до логики гранта дело не
 *   дошло: вопрос к деплою (404 — ручек нет, 500 — шлюз упал, 400 — тело собрано
 *   не так). Без проверки `ok` деплой без этих ручек читался бы как ошибка
 *   разбора, то есть как ошибка вот этого файла.
 * - `BAD_RESPONSE` — ответ пришёл с рабочим статусом и не разобрался: вопрос как
 *   раз к этому файлу.
 * - `SIGN_FAILED` — подписант (анклав) отказался подписать нонс. Это не
 *   `USER_REJECTED`: у встроенного кошелька нет пользователя, который мог бы
 *   отказаться, и указывать отлаживающему на диалог кошелька было бы ложью.
 */
type LocalGasGrantReason = "HTTP_ERROR" | "BAD_RESPONSE" | "SIGN_FAILED";

/**
 * @remarks
 * `status` несётся только для отказного HTTP-статуса, где одной причины мало,
 * чтобы понять, что делать. На остальных исходах статуса просто нет.
 */
export type GasGrantOutcome = {
  funded: boolean;
  reason?: GasGrantReason | LocalGasGrantReason;
  status?: number;
};

/**
 * Полезная нагрузка внутри конверта `{ data, meta }`.
 *
 * @remarks
 * Глобальный `ResponseInterceptor` шлюза заворачивает каждый JSON-ответ (живая
 * проверка staging 2026-09-04: `{"data":{"nonce":"…"},"meta":{…}}`), поэтому
 * проверки формы обязаны идти по `data`. Голое тело пропускается как есть, а не
 * отвергается: этот же код обслуживает локальные и мок-шлюзы без конверта.
 */
function envelopePayload(body: unknown): unknown {
  if (
    typeof body === "object" &&
    body !== null &&
    "data" in body &&
    (body as { data?: unknown }).data !== undefined
  ) {
    return (body as { data: unknown }).data;
  }
  return body;
}

/**
 * Что означает не-2xx.
 *
 * @remarks
 * Обычный отказ шлюз выражает исходом с кодом 2xx, поэтому отказной статус
 * значит, что до логики гранта не дошли. Исключение — глобальный
 * `ThrottlerGuard`, который умеет говорить только статусами: 429 — это тот же
 * отказ, который фаусет называет `RATE_LIMITED`, и показывать его как сбой было
 * бы неправдой о том, чья это проблема.
 */
function statusRefusal(status: number): GasGrantOutcome {
  return {
    funded: false,
    reason: status === 429 ? "RATE_LIMITED" : "HTTP_ERROR",
    status,
  };
}

function isNonceBody(body: unknown): body is { nonce: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { nonce?: unknown }).nonce === "string"
  );
}

function isGasGrantBody(
  body: unknown,
): body is { funded: boolean; reason?: unknown } {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { funded?: unknown }).funded === "boolean"
  );
}

/**
 * Просит шлюз налить газа свежему встроенному кошельку.
 *
 * @remarks
 * Идёт до создания аккаунта, потому что это первая ончейн-запись, и ей нужен
 * газ, которого у нового адреса нет. Аутентификация здесь — подпись, а не токен:
 * токена ещё не существует, шлюз привязывает его к accountId, которого тоже нет.
 *
 * Никогда не бросает: «не налили» — обычный исход (вернувшемуся пользователю уже
 * наливали, часть деплоев живёт с выключенным фаусетом), и онбординг обязан
 * продолжаться. Каждый шаг падает в ту причину, которая его объясняет, а не в
 * общий catch: нерасшифрованный ответ, отказ подписи и оборванная связь — три
 * разные проблемы для того, кто разбирает застрявший онбординг.
 */
export async function requestGasGrant(input: {
  gatewayUrl: string;
  address: `0x${string}`;
  subOrgId: string;
  signMessage: (args: { message: string }) => Promise<`0x${string}`>;
  fetchImpl?: typeof fetch;
}): Promise<GasGrantOutcome> {
  const doFetch = input.fetchImpl ?? fetch;

  let nonceRes: Response;
  try {
    nonceRes = await doFetch(`${input.gatewayUrl}/auth/gas-nonce`);
  } catch {
    return { funded: false, reason: "NETWORK" };
  }
  if (!nonceRes.ok) return statusRefusal(nonceRes.status);

  let nonceBody: unknown;
  try {
    nonceBody = envelopePayload(await nonceRes.json());
  } catch {
    return { funded: false, reason: "BAD_RESPONSE" };
  }
  if (!isNonceBody(nonceBody)) return { funded: false, reason: "BAD_RESPONSE" };
  const { nonce } = nonceBody;

  let signature: `0x${string}`;
  try {
    // Текст берётся из @liq/core, а не переписывается здесь: шлюз сверяет
    // подпись через `verifyMessage`, поэтому лишний пробел или иной перенос
    // строки даёт BAD_SIGNATURE — отказ, со стороны клиента неотличимый от
    // чужого нонса. Вторая копия этой строки и была тем самым тихим швом.
    signature = await input.signMessage({ message: gasGrantMessage(nonce) });
  } catch {
    return { funded: false, reason: "SIGN_FAILED" };
  }

  let res: Response;
  try {
    res = await doFetch(`${input.gatewayUrl}/auth/gas`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        address: input.address,
        nonce,
        signature,
        subOrgId: input.subOrgId,
      }),
    });
  } catch {
    return { funded: false, reason: "NETWORK" };
  }
  if (!res.ok) return statusRefusal(res.status);

  let body: unknown;
  try {
    body = envelopePayload(await res.json());
  } catch {
    return { funded: false, reason: "BAD_RESPONSE" };
  }
  if (!isGasGrantBody(body)) return { funded: false, reason: "BAD_RESPONSE" };
  return {
    funded: body.funded,
    reason: body.reason === undefined ? undefined : asGasGrantReason(body.reason),
  };
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `pnpm test src/features/wallet/__tests__/gasGrant.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/features/wallet/gasGrant.ts src/features/wallet/__tests__/gasGrant.test.ts
git commit -m "feat(wallet): запрос долива газа для свежего встроенного кошелька"
```

---

### Task 7: Лестница личности — редьюсер

Три шага: `resolve → connect → gas`. Шаги `account` и `siwe` в терминале остаются кнопками — это то, что эталонный терминал показывает интегратору.

**Files:**
- Create: `src/features/auth/turnkeyLadder.ts`
- Create: `src/features/auth/__tests__/turnkeyLadder.test.ts`

**Interfaces:**
- Consumes: `type SessionStage` из `./sessionStage`, `type GasGrantOutcome` из `../wallet/gasGrant` (задача 6).
- Produces: `initialLadderState`, `ladderNext`, `ladderSettle`, `ladderRetry`, `identityChanged`, `embeddedWalletView`, `heldAccountIsCurrent`, `holdAccount`, типы `LadderState`/`LadderCtx`/`LadderEffect`/`LadderOutcome`/`LadderStep`/`EmbeddedWalletState` — всё читает задача 8.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/auth/__tests__/turnkeyLadder.test.ts
import { describe, expect, it } from "vitest";

import {
  embeddedWalletView,
  heldAccountIsCurrent,
  holdAccount,
  initialLadderState,
  ladderNext,
  ladderRetry,
  ladderSettle,
  type LadderCtx,
  type LadderState,
} from "../turnkeyLadder";

const ADDR = "0x2222222222222222222222222222222222222222" as const;

function ctx(over: Partial<LadderCtx> = {}): LadderCtx {
  return {
    key: "sub-1",
    stage: "disconnected",
    wagmi: {
      isConnected: false,
      isConnecting: false,
      isReconnecting: false,
      address: null,
    },
    tokenAddress: null,
    silentSigner: false,
    ...over,
  };
}

/** Прогоняет наблюдение и отдаёт пару «состояние + эффект». */
function step(state: LadderState, c: LadderCtx) {
  return ladderNext(state, c);
}

describe("ladderNext", () => {
  it("без аутентификации ничего не делает", () => {
    const r = step(initialLadderState, ctx({ key: null }));
    expect(r.effect.kind).toBe("none");
  });

  it("смена личности сбрасывает лестницу", () => {
    const first = step(initialLadderState, ctx()).state;
    const r = step(first, ctx({ key: "sub-2" }));
    expect(r.effect.kind).toBe("reset");
    expect(r.state.key).toBe("sub-2");
    expect(r.state.attempts).toEqual({});
  });

  it("выход — это тоже смена личности, на null", () => {
    const first = step(initialLadderState, ctx()).state;
    const r = step(first, ctx({ key: null }));
    expect(r.effect.kind).toBe("reset");
    expect(r.state.key).toBeNull();
  });

  it("после смены ключа seq не откатывается", () => {
    const first = step(initialLadderState, ctx()).state;
    const r = step(first, ctx({ key: "sub-2" }));
    expect(r.state.seq).toBeGreaterThan(first.seq);
  });

  it("токен от другого кошелька сбрасывает лестницу", () => {
    const first = step(initialLadderState, ctx()).state;
    const r = step(
      first,
      ctx({
        wagmi: { ...ctx().wagmi, address: "0xaaa" },
        tokenAddress: "0xbbb",
      }),
    );
    expect(r.effect.kind).toBe("reset");
  });

  it("восстановленный токен без подключённого кошелька — не рассинхрон", () => {
    const first = step(initialLadderState, ctx()).state;
    const r = step(first, ctx({ tokenAddress: "0xbbb" }));
    expect(r.effect.kind).not.toBe("reset");
  });

  it("первым делом разрешает встроенный кошелёк", () => {
    const r = step(initialLadderState, ctx());
    expect(r.effect).toEqual({ kind: "resolve-signer", seq: 1 });
    expect(r.state.attempts.resolve).toEqual({ status: "inflight", seq: 1 });
  });

  it("не запускает разрешение второй раз, пока первое в полёте", () => {
    const first = step(initialLadderState, ctx()).state;
    expect(step(first, ctx()).effect.kind).toBe("none");
  });

  it("упавшее разрешение само не перезапускается", () => {
    const started = step(initialLadderState, ctx()).state;
    const failed = ladderSettle(started, {
      step: "resolve",
      ok: false,
      seq: 1,
      error: new Error("нет сессии"),
    });
    expect(step(failed, ctx()).effect.kind).toBe("none");
  });

  it("retry переоткрывает упавший шаг", () => {
    const started = step(initialLadderState, ctx()).state;
    const failed = ladderSettle(started, {
      step: "resolve",
      ok: false,
      seq: 1,
      error: new Error("нет сессии"),
    });
    const rearmed = ladderRetry(failed, "resolve");
    expect(step(rearmed, ctx()).effect.kind).toBe("resolve-signer");
  });

  it("приземление с чужим seq игнорируется", () => {
    const started = step(initialLadderState, ctx()).state;
    const stale = ladderSettle(started, {
      step: "resolve",
      ok: true,
      seq: 99,
      address: ADDR,
    });
    expect(stale).toBe(started);
  });

  it("после разрешения отдаёт подписанта в wagmi", () => {
    const started = step(initialLadderState, ctx()).state;
    const resolved = ladderSettle(started, {
      step: "resolve",
      ok: true,
      seq: 1,
      address: ADDR,
    });
    const r = step(resolved, ctx());
    expect(r.effect.kind).toBe("connect");
  });

  it("не долбит connect, пока wagmi подключается", () => {
    const started = step(initialLadderState, ctx()).state;
    const resolved = ladderSettle(started, {
      step: "resolve", ok: true, seq: 1, address: ADDR,
    });
    const c = ctx({ wagmi: { ...ctx().wagmi, isConnecting: true } });
    expect(step(resolved, c).effect.kind).toBe("none");
  });

  it("живое подключение снимает отметку connect, оборвавшееся — пробует снова", () => {
    const started = step(initialLadderState, ctx()).state;
    const resolved = ladderSettle(started, {
      step: "resolve", ok: true, seq: 1, address: ADDR,
    });
    const connecting = step(resolved, ctx()).state;
    const connected = step(
      connecting,
      ctx({ wagmi: { ...ctx().wagmi, isConnected: true } }),
    ).state;
    expect(connected.attempts.connect).toBeUndefined();
    expect(step(connected, ctx()).effect.kind).toBe("connect");
  });

  it("газ просит один раз, перед созданием аккаунта", () => {
    const started = step(initialLadderState, ctx()).state;
    const resolved = ladderSettle(started, {
      step: "resolve", ok: true, seq: 1, address: ADDR,
    });
    const c = ctx({
      stage: "no-account",
      silentSigner: true,
      wagmi: { ...ctx().wagmi, isConnected: true, address: ADDR.toLowerCase() },
    });
    const r = step(resolved, c);
    expect(r.effect).toMatchObject({ kind: "gas", address: ADDR });
    expect(step(r.state, c).effect.kind).toBe("none");
  });

  it("отказ в газе закрывает шаг как «спросили», а не как провал", () => {
    const started = step(initialLadderState, ctx()).state;
    const resolved = ladderSettle(started, {
      step: "resolve", ok: true, seq: 1, address: ADDR,
    });
    const c = ctx({
      stage: "no-account",
      silentSigner: true,
      wagmi: { ...ctx().wagmi, isConnected: true, address: ADDR.toLowerCase() },
    });
    const asked = step(resolved, c);
    const seq = asked.effect.kind === "gas" ? asked.effect.seq : -1;
    const settled = ladderSettle(asked.state, {
      step: "gas",
      seq,
      outcome: { funded: false, reason: "ALREADY_FUNDED" },
    });
    expect(settled.attempts.gas?.status).toBe("ok");
    expect(settled.gasOutcome).toEqual({ funded: false, reason: "ALREADY_FUNDED" });
  });
});

describe("embeddedWalletView", () => {
  it("проецирует шаг разрешения на то, что читает экран", () => {
    expect(embeddedWalletView(initialLadderState)).toEqual({ kind: "idle" });
    const started = ladderNext(initialLadderState, ctx()).state;
    expect(embeddedWalletView(started)).toEqual({ kind: "resolving" });
    const ready = ladderSettle(started, {
      step: "resolve", ok: true, seq: 1, address: ADDR,
    });
    expect(embeddedWalletView(ready)).toEqual({ kind: "ready", address: ADDR });
  });
});

describe("удержание аккаунта", () => {
  it("держит только приземление текущей попытки", () => {
    const started = ladderNext(initialLadderState, ctx()).state;
    const ready = ladderSettle(started, {
      step: "resolve", ok: true, seq: 1, address: ADDR,
    });
    expect(heldAccountIsCurrent(ready, 1)).toBe(true);
    expect(heldAccountIsCurrent(ready, 0)).toBe(false);
  });

  it("позднее приземление отменённой попытки не затирает живое", () => {
    expect(holdAccount({ seq: 5, account: "живой" }, 3, "мёртвый")).toEqual({
      seq: 5,
      account: "живой",
    });
    expect(holdAccount({ seq: 3, account: "старый" }, 5, "новый")).toEqual({
      seq: 5,
      account: "новый",
    });
  });
});
```

- [ ] **Step 2: Прогнать и убедиться, что падает**

Run: `pnpm test src/features/auth/__tests__/turnkeyLadder.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать**

```ts
// src/features/auth/turnkeyLadder.ts
import type { GasGrantOutcome } from "../wallet/gasGrant";
import type { SessionStage } from "./sessionStage";

/**
 * Лестница личности: подписант → wagmi → газ. Один редьюсер, ни строчки React.
 *
 * @remarks
 * Здесь живут ПОПЫТКИ, а не ступень. Где сессия стоит на самом деле, по-прежнему
 * выводит `sessionStage()` из живых запросов; редьюсер, который дублировал бы
 * это, разъехался бы с react-query на первом же перезапросе. Здесь то, чего ни
 * один запрос не знает: что мы для этой личности уже пробовали и чем это
 * кончилось.
 *
 * Шагов три, а не пять, как в `liqu`: создание аккаунта и вход подписью в
 * терминале нажимает пользователь — это и есть то, что эталон показывает
 * интегратору.
 */
export type LadderStep = "resolve" | "connect" | "gas";

/**
 * Одна попытка одного шага.
 *
 * @remarks
 * `seq` — не счётчик повторов, а адрес: он говорит, КАКАЯ попытка приземлилась.
 * Результат попытки, которую уже сменили — вышли и вошли снова, нажали повтор —
 * не находит своего seq и отбрасывается вместо того, чтобы затереть живой ответ.
 */
export type Attempt = { status: "inflight" | "ok" | "failed"; seq: number };

export type LadderState = {
  /** subOrgId. `null`, пока не вошли: выход — это тоже смена личности. */
  key: string | null;
  /** Монотонный, +1 на каждый испущенный эффект. Не откатывается даже сбросом. */
  seq: number;
  attempts: Partial<Record<LadderStep, Attempt>>;
  /** Узнаётся из шага `resolve`; до его приземления отсутствует. */
  address?: `0x${string}`;
  gasOutcome?: GasGrantOutcome;
  error?: Error;
};

/**
 * Наблюдаемый мир. Пересчитывается на каждый рендер, никогда не хранится.
 *
 * @remarks
 * Всё здесь прочитано откуда-то ещё — react-query, wagmi, хранилище шлюза.
 * Держать это вне `LadderState` — то, что не даёт редьюсеру стать второй, более
 * старой копией состояния, у которого уже есть владелец.
 */
export type LadderCtx = {
  key: string | null;
  stage: SessionStage;
  wagmi: {
    isConnected: boolean;
    isConnecting: boolean;
    isReconnecting: boolean;
    /** Приведён к нижнему регистру вызывающим: wagmi отдаёт EIP-55, токен — нет. */
    address: string | null;
  };
  /** Адрес внутри сохранённого токена шлюза, в нижнем регистре, либо null. */
  tokenAddress: string | null;
  silentSigner: boolean;
};

export type LadderEffect =
  | { kind: "none" }
  | { kind: "reset"; seq: number }
  | { kind: "resolve-signer"; seq: number }
  | { kind: "connect"; seq: number }
  | { kind: "gas"; seq: number; address: `0x${string}` };

/**
 * Что раннер сообщает о приземлении.
 *
 * @remarks
 * У `connect` варианта нет, и это решение, а не пропуск: `connect` в wagmi —
 * это `mutate()` из react-query, его отказ проглатывается внутри, сообщать
 * нечего. Шаг закрывается наблюдением — `normalise` снимает отметку, когда
 * `wagmi.isConnected` становится истиной. Цена: единственный из трёх шагов, что
 * не умеет заполнить `state.error`; не доехавший connect лечится перезагрузкой.
 */
export type LadderOutcome =
  | { step: "resolve"; ok: true; seq: number; address: `0x${string}` }
  | { step: "resolve"; ok: false; seq: number; error: unknown }
  | { step: "gas"; seq: number; outcome: GasGrantOutcome };

/** Куда дошло разрешение встроенного кошелька — для тех, кто это показывает. */
export type EmbeddedWalletState =
  | { kind: "idle" }
  | { kind: "resolving" }
  | { kind: "ready"; address: `0x${string}` }
  | { kind: "failed"; error: unknown };

export const initialLadderState: LadderState = { key: null, seq: 0, attempts: {} };

const NONE: LadderEffect = { kind: "none" };

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/**
 * Начинает лестницу заново под новой личностью.
 *
 * @remarks
 * `seq` намеренно переносится, а не обнуляется: запрос, оставшийся в полёте от
 * покидаемой личности, не должен суметь совпасть с попыткой, записанной под
 * новой. Очистка `attempts` — то, что делает каждый шаг доступным снова;
 * сохранение `seq` — то, что делает старые ответы неадресуемыми.
 */
export function identityChanged(state: LadderState, next: string | null): LadderState {
  return { key: next, seq: state.seq, attempts: {} };
}

/** Отмечает попытку как летящую и отдаёт seq, которым она адресуется. */
function begin(state: LadderState, step: LadderStep): { state: LadderState; seq: number } {
  const seq = state.seq + 1;
  return {
    state: { ...state, seq, attempts: { ...state.attempts, [step]: { status: "inflight", seq } } },
    seq,
  };
}

/**
 * Применяет одно приземление.
 *
 * @remarks
 * Отказ в газе закрывается как `'ok'`, а не как `'failed'`: `attempts.gas`
 * значит «мы попросили», а не «нам налили». Записанный провалом, он держал бы
 * пользователя на шаге газа вечно, тогда как `ALREADY_FUNDED` — обычный ответ
 * вернувшемуся. Показывать ли отказ, решается по `gasOutcome`, а не остановкой
 * лестницы.
 */
export function ladderSettle(state: LadderState, outcome: LadderOutcome): LadderState {
  if (state.attempts[outcome.step]?.seq !== outcome.seq) return state;

  const settled = (status: Attempt["status"]) => ({
    ...state.attempts,
    [outcome.step]: { status, seq: outcome.seq },
  });

  if (outcome.step === "gas") {
    return { ...state, attempts: settled("ok"), gasOutcome: outcome.outcome };
  }
  if (!outcome.ok) {
    return { ...state, attempts: settled("failed"), error: toError(outcome.error) };
  }
  return { ...state, attempts: settled("ok"), address: outcome.address };
}

/**
 * Переоткрывает один упавший шаг по команде пользователя.
 *
 * @remarks
 * Единственный выход из провала: одна автоматическая попытка на личность, дальше
 * стоп — в этом весь договор, цикл повторов это не восстановление. Намеренно не
 * внутри `ladderNext`: это команда, а не наблюдение, а `ctx` состоит только из
 * наблюдений.
 */
export function ladderRetry(state: LadderState, step: LadderStep): LadderState {
  if (state.attempts[step]?.status !== "failed") return state;
  const attempts = { ...state.attempts };
  delete attempts[step];
  return { ...state, attempts, error: undefined };
}

/**
 * Приводит состояние в соответствие наблюдаемому миру до разбора правил.
 *
 * @remarks
 * Это НЕ ветка разбора. При «первое совпадение выигрывает» подключённый wagmi
 * возвращался бы отсюда, и лестница никогда не дошла бы до газа — ровно та
 * ошибка, ради которой это вынесено отдельно.
 */
function normalise(state: LadderState, ctx: LadderCtx): LadderState {
  // Живое подключение снимает защёлку connect. Защищаемся от повтора, пока
  // отключены, а не от подключения после отключения: соединение, которое
  // получилось и потом отвалилось, заслуживает новой попытки, а неудавшееся —
  // нет. Неудачу wagmi не сообщает никак (это `mutate()`), поэтому «не вышло»
  // выражено как «отметка есть, а isConnected ложно».
  if (ctx.wagmi.isConnected && state.attempts.connect) {
    const attempts = { ...state.attempts };
    delete attempts.connect;
    return { ...state, attempts };
  }
  return state;
}

/**
 * Единственный переход: что лестнице делать дальше и каким состоянием это
 * решение записано.
 */
export function ladderNext(
  state: LadderState,
  ctx: LadderCtx,
): { state: LadderState; effect: LadderEffect } {
  const current = normalise(state, ctx);

  // 1. Личность сменилась — в том числе на null, а это и есть выход.
  if (ctx.key !== current.key) {
    const cleared = identityChanged(current, ctx.key);
    const seq = cleared.seq + 1;
    return { state: { ...cleared, seq }, effect: { kind: "reset", seq } };
  }

  // 2. Сохранённый токен называет не тот кошелёк, что подключён. Проверка на
  //    подключённый адрес несущая: восстановленный токен при ещё не
  //    подключённом wagmi — обычное дело, а не рассинхрон, и без неё живая
  //    сессия сбрасывалась бы на каждом холодном старте.
  if (ctx.wagmi.address && ctx.tokenAddress && ctx.tokenAddress !== ctx.wagmi.address) {
    const cleared = identityChanged(current, current.key);
    const seq = cleared.seq + 1;
    return { state: { ...cleared, seq }, effect: { kind: "reset", seq } };
  }

  // 3. Не вошли — лезть некуда.
  if (ctx.key === null) return { state: current, effect: NONE };

  // 4. Подписант. `createEmbeddedWallet` — это fetch-or-create, поэтому второе
  //    одновременное разрешение суб-организации без кошелька создаёт ВТОРОЙ
  //    кошелёк, а `SnxAccount.owner` пишется один раз и не переписывается —
  //    аккаунт проигравшего недостижим навсегда. Эта отметка и есть та
  //    гарантия, которую нельзя доверить модульному промису.
  if (!current.attempts.resolve) {
    const { state: next, seq } = begin(current, "resolve");
    return { state: next, effect: { kind: "resolve-signer", seq } };
  }

  // 5. Разрешение, не приземлившееся в 'ok', останавливает лестницу. Провал,
  //    переоткрывающий себя сам, был бы бесконечным повтором сетевых вызовов:
  //    эффект, который его гоняет, держит это состояние в зависимостях.
  //    Восстановление — `ladderRetry`, по клику.
  //    Половина `!current.address` тоже несущая: она сужает `current.address` до
  //    непустого `0x${string}`, которого требует поле эффекта `gas` в правиле 7.
  if (current.attempts.resolve.status !== "ok" || !current.address) {
    return { state: current, effect: NONE };
  }

  // 6. Отдаём подписанта в wagmi. Под защёлкой, потому что неудавшийся
  //    `connect()` переключает статус wagmi, статус лежит в зависимостях
  //    гоняющего эффекта, и эффект срабатывает снова — в `liqu` это намеряли
  //    как ~200 попыток за несколько секунд при вкладке на 100% CPU.
  if (
    !ctx.wagmi.isConnected &&
    !ctx.wagmi.isConnecting &&
    !ctx.wagmi.isReconnecting &&
    !current.attempts.connect
  ) {
    const { state: next, seq } = begin(current, "connect");
    return { state: next, effect: { kind: "connect", seq } };
  }

  // 7. Газ от шлюза. Идёт до первой ончейн-записи, потому что встроенный
  //    кошелёк создаётся пустым. `address` — разрешённого подписанта, а не
  //    wagmi: сегодня они совпадают, но получить газ должен именно тот, за кого
  //    подписан запрос.
  if (ctx.silentSigner && ctx.stage === "no-account" && !current.attempts.gas) {
    const { state: next, seq } = begin(current, "gas");
    return { state: next, effect: { kind: "gas", seq, address: current.address } };
  }

  return { state: current, effect: NONE };
}

/** Проецирует шаг разрешения на форму, которую читает экран входа. */
export function embeddedWalletView(state: LadderState): EmbeddedWalletState {
  const attempt = state.attempts.resolve;
  if (!attempt) return { kind: "idle" };
  if (attempt.status === "inflight") return { kind: "resolving" };
  if (attempt.status === "failed") return { kind: "failed", error: state.error };
  // 'ok' без адреса через `ladderSettle` недостижимо, но тип это допускает, а
  // 'ready' без адреса был бы ложью.
  return state.address ? { kind: "ready", address: state.address } : { kind: "resolving" };
}

/**
 * Принадлежит ли удержанный по `heldSeq` аккаунт той попытке, которую состояние
 * считает текущей.
 *
 * @remarks
 * Разрешённый `LocalAccount` живёт в ref, вне редьюсера: объекту с методами не
 * место в чистом состоянии. Это же выносит его из-под seq-проверки
 * `ladderSettle` — приземление отменённой личности отбрасывается из состояния и
 * всё равно перезаписывает ref. Адресация тем же `seq` это закрывает: старая
 * запись не совпадёт с живой попыткой и станет инертной вместо ядовитой. Без
 * этого выход во время летящего разрешения с последующим входом другого
 * пользователя отдал бы новой сессии подписанта предыдущей.
 */
export function heldAccountIsCurrent(state: LadderState, heldSeq: number | undefined): boolean {
  const attempt = state.attempts.resolve;
  return attempt?.status === "ok" && attempt.seq === heldSeq;
}

/**
 * Какой аккаунт держать после приземления: более новый из удержанного и
 * пришедшего.
 *
 * @remarks
 * Монотонно по `seq`, ровно как высшая отметка в `claim()`. Адресация не даёт
 * старое приземление ПОКАЗАТЬ; она не мешает его ЗАПИСАТЬ, а запись поверх
 * живого оставила бы текущую сессию с удержанным seq, который уже никогда не
 * совпадёт, — то есть без подписанта до конца жизни. `seq` не откатывается,
 * поэтому «старее» — это обычное сравнение. Обобщено по аккаунту, чтобы файл
 * оставался без viem на поверхности.
 */
export function holdAccount<T>(
  held: { seq: number; account: T } | undefined,
  seq: number,
  account: T,
): { seq: number; account: T } {
  return held && held.seq > seq ? held : { seq, account };
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `pnpm test src/features/auth/__tests__/turnkeyLadder.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/features/auth/turnkeyLadder.ts src/features/auth/__tests__/turnkeyLadder.test.ts
git commit -m "feat(auth): лестница личности Turnkey — подписант, wagmi, газ"
```

---

### Task 8: Провайдер личности, раннеры и монтирование

**Files:**
- Create: `src/features/auth/TurnkeyIdentityProvider.tsx`
- Create: `src/features/auth/EmbeddedWalletRunner.tsx`
- Create: `src/features/auth/GasGrantRunner.tsx`
- Create: `src/features/auth/useSessionStage.ts`
- Modify: `src/features/auth/SessionGate.tsx`
- Modify: `src/providers/LiqSetup.tsx`

**Interfaces:**
- Consumes: всё из задач 1, 2, 4, 5, 6, 7.
- Produces: `useTurnkeyIdentity(): TurnkeyIdentityValue` c полями `state`, `effect`, `account`, `embedded: EmbeddedWalletState`, `claim`, `settle`, `settleResolve`, `retryResolve`, `silentSigner` — читает задача 9. Плюс `useSessionStageLocal(): SessionStage`.

- [ ] **Step 1: Вынести вычисление ступени в хук**

`SessionGate` считает ступень внутри себя, а провайдеру личности нужна та же ступень. Создать `src/features/auth/useSessionStage.ts`:

```ts
import {
  selectIsAuthenticated,
  useAccountQuery,
  useGatewayStore,
  useWallet,
} from "@liq/react";
import { useAccount } from "wagmi";

import { env } from "../../config/env";
import { sessionStage, type SessionStage } from "./sessionStage";

/**
 * Ступень сессии — одним значением, для всех, кому она нужна.
 *
 * @remarks
 * Локальная, а не `useSessionStage` из `@liq/react`: та берёт сеть из
 * конфигурации `LiqProvider`, здесь же сравнение идёт с `env.chainId`, и переезд
 * на неё — отдельная уборка, не входящая в эту задачу.
 *
 * Рассинхрон ловится по КОННЕКТОРУ (`useAccount().chainId`), а не по
 * `useChainId()`: последний отдаёт сеть из конфига wagmi (6343) даже когда
 * кошелёк стоит на ненастроенной сети, и рассинхрона попросту не видит.
 */
export function useSessionStageLocal(): SessionStage {
  const wallet = useWallet();
  // Флаг загрузки, а не только `useAccountId()`: последний схлопывает «ещё
  // грузится» и «аккаунта нет» в один `undefined`, и экран мигал бы кнопкой
  // создания аккаунта до ответа ончейн-запроса.
  const { data: accountIds, isLoading: accountsLoading } = useAccountQuery();
  const isAuthenticated = useGatewayStore(selectIsAuthenticated);
  const account = useAccount();
  return sessionStage({
    wallet,
    wrongChain: account.isConnected && account.chainId !== env.chainId,
    accountId: accountIds?.[0],
    accountsLoading,
    isAuthenticated,
  });
}
```

В `SessionGate.tsx` заменить локальное вычисление на `const stage = useSessionStageLocal();`, сохранив `useAccountQuery()` там, где `accountId` нужен кнопкам (`createAccount`/`signIn`), и убрав ставшие лишними `useWallet`/`selectIsAuthenticated`/`sessionStage`-импорты. Остальную логику `SessionGate` не трогать.

- [ ] **Step 2: Проверить, что рефакторинг ничего не сдвинул**

Run: `pnpm typecheck && pnpm lint && pnpm test:e2e e2e/tier1/01-onboarding.spec.ts e2e/tier1/07-trade-gating.spec.ts`
Expected: PASS.

- [ ] **Step 3: Написать провайдер личности**

```tsx
// src/features/auth/TurnkeyIdentityProvider.tsx
import {
  AUTHED_QUERY_PREFIXES,
  AuthState,
  useGatewayStore,
  useTurnkey,
} from "@liq/react";
import {
  createEmbeddedProvider,
  setTurnkeyProvider,
  TURNKEY_CONNECTOR_ID,
} from "@liq/turnkey";
import { tokenAddress } from "@liq/core";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type { LocalAccount } from "viem";
import { useAccount, useConnect, useReconnect } from "wagmi";

import { megaethTestnet } from "../../config/chain";
import { env } from "../../config/env";
import { useSessionStageLocal } from "./useSessionStage";
import {
  embeddedWalletView,
  heldAccountIsCurrent,
  holdAccount,
  initialLadderState,
  ladderNext,
  ladderRetry,
  ladderSettle,
  type EmbeddedWalletState,
  type LadderCtx,
  type LadderEffect,
  type LadderOutcome,
  type LadderState,
} from "./turnkeyLadder";

export type TurnkeyIdentityValue = {
  state: LadderState;
  effect: LadderEffect;
  account: LocalAccount | undefined;
  embedded: EmbeddedWalletState;
  /** subOrgId текущей личности — его требует тело запроса на газ. */
  subOrgId: string | null;
  claim: (effect: LadderEffect) => boolean;
  settle: (outcome: LadderOutcome) => void;
  settleResolve: (
    seq: number,
    result:
      | { ok: true; address: `0x${string}`; account: LocalAccount }
      | { ok: false; error: unknown },
  ) => void;
  retryResolve: () => void;
  silentSigner: boolean;
};

const TurnkeyIdentityContext = createContext<TurnkeyIdentityValue | null>(null);

/** Читает личность Turnkey. Бросает вне `<TurnkeyIdentityProvider>`. */
export function useTurnkeyIdentity(): TurnkeyIdentityValue {
  const value = useContext(TurnkeyIdentityContext);
  if (!value) {
    throw new Error("useTurnkeyIdentity: только внутри <TurnkeyIdentityProvider>");
  }
  return value;
}

type Machine = { state: LadderState; effect: LadderEffect };
type Action =
  | { type: "observe"; ctx: LadderCtx }
  | { type: "settle"; outcome: LadderOutcome }
  | { type: "retry" };

const NONE: LadderEffect = { kind: "none" };

function machineReduce(machine: Machine, action: Action): Machine {
  switch (action.type) {
    case "observe": {
      const next = ladderNext(machine.state, action.ctx);
      // Сравнение по идентичности, не по глубокому равенству: `ladderNext`
      // возвращает тот же объект состояния, когда ничего не сдвинулось, а React
      // на том же значении редьюсера не перерисовывает — это и не даёт эффекту
      // наблюдения кормить самого себя.
      if (next.state === machine.state && next.effect.kind === "none") return machine;
      return next;
    }
    // Оба ниже переносят `machine.effect` нетронутым. Обнулить его значило бы
    // потерять эффект, который испущен, но ещё не заявлен: клик «повторить»,
    // попавший между коммитом и сбросом эффектов, оставил бы лестницу с
    // отметкой «летит» и без того, кто её гоняет. `claim()` — единственный
    // арбитр начатого, поэтому пронести отработанный эффект ничего не стоит:
    // раннер, увидевший его снова, получит отказ по seq.
    case "settle":
      return { state: ladderSettle(machine.state, action.outcome), effect: machine.effect };
    case "retry":
      return { state: ladderRetry(machine.state, "resolve"), effect: machine.effect };
  }
}

/**
 * Владелец лестницы личности и мост между Turnkey и wagmi.
 *
 * @remarks
 * Монтируется внутри `<TurnkeyProviderWrapper>` (нужен `useTurnkey`) и внутри
 * `<LiqProvider>` / `<WagmiProvider>` (нужны ступень сессии и `useConnect`).
 *
 * Две ссылки живут здесь, и обе — по причинам, которых редьюсер не покрывает.
 * `ranSeq` за `claim` — высшая отметка реально начатых эффектов: StrictMode в
 * React 19 прогоняет setup эффекта дважды до того, как коммитится диспатч
 * первого прогона, и оба прогона видят один эффект. `accountRef` держит
 * `LocalAccount`: объекту с методами не место в состоянии редьюсера, а чистить
 * его внутри чистой функции было бы побочным эффектом в апдейтере, который
 * StrictMode вызывает дважды.
 */
export function TurnkeyIdentityProvider({ children }: { children: ReactNode }) {
  const { authState, session } = useTurnkey();
  const stage = useSessionStageLocal();
  const wagmiAccount = useAccount();
  const token = useGatewayStore((s) => s.token);
  const queryClient = useQueryClient();
  const { connect, connectors } = useConnect();
  const { reconnect } = useReconnect();

  const [machine, dispatch] = useReducer(machineReduce, {
    state: initialLadderState,
    effect: NONE,
  });

  const accountRef = useRef<{ seq: number; account: LocalAccount } | undefined>(undefined);
  const ranSeq = useRef(0);

  const subOrgId =
    authState === AuthState.Authenticated ? (session?.organizationId ?? null) : null;

  const silentSigner = Boolean(
    machine.state.address && heldAccountIsCurrent(machine.state, accountRef.current?.seq),
  );

  const wagmiAddress = wagmiAccount.address?.toLowerCase() ?? null;

  const ctx = useMemo<LadderCtx>(
    () => ({
      key: subOrgId,
      stage,
      wagmi: {
        isConnected: wagmiAccount.isConnected,
        isConnecting: wagmiAccount.isConnecting,
        isReconnecting: wagmiAccount.isReconnecting,
        address: wagmiAddress,
      },
      tokenAddress: tokenAddress(token),
      silentSigner,
    }),
    [
      subOrgId,
      stage,
      wagmiAccount.isConnected,
      wagmiAccount.isConnecting,
      wagmiAccount.isReconnecting,
      wagmiAddress,
      token,
      silentSigner,
    ],
  );

  useEffect(() => {
    dispatch({ type: "observe", ctx });
  }, [ctx, machine.state]);

  const claim = useCallback((effect: LadderEffect) => {
    if (effect.kind === "none" || effect.seq <= ranSeq.current) return false;
    ranSeq.current = effect.seq;
    return true;
  }, []);

  // Гигиена сессии на сбросе: токен шлюза принадлежит одному кошельку, поэтому
  // смена личности, выход или восстановленный токен с чужим адресом одинаково
  // роняют токен, приватные кэши и реестр провайдеров. `removeQueries`, а не
  // инвалидация: перезапрос со старым токеном воспроизвёл бы ровно то, что
  // убирали.
  useEffect(() => {
    if (machine.effect.kind !== "reset") return;
    if (!claim(machine.effect)) return;
    accountRef.current = undefined;
    useGatewayStore.getState().clearToken();
    setTurnkeyProvider(undefined);
    for (const prefix of AUTHED_QUERY_PREFIXES) {
      queryClient.removeQueries({ queryKey: prefix });
    }
  }, [machine.effect, claim, queryClient]);

  // Разрешённый подписант становится EIP-1193-провайдером и уходит в реестр:
  // ключ в TEE не расширение браузера, в списке `walletProviders` у Turnkey его
  // не бывает, поэтому провайдер синтезируется.
  useEffect(() => {
    if (authState !== AuthState.Authenticated || !silentSigner) {
      setTurnkeyProvider(undefined);
      return;
    }
    const account = accountRef.current?.account;
    if (!account) return;
    setTurnkeyProvider(
      createEmbeddedProvider({ account, chain: megaethTestnet, rpcUrl: env.rpcUrl }),
    );
  }, [authState, silentSigner]);

  useEffect(() => {
    if (machine.effect.kind !== "connect") return;
    const connector = connectors.find((c) => c.id === TURNKEY_CONNECTOR_ID);
    if (!connector) return;
    if (!claim(machine.effect)) return;
    // Оба вызова уходят не дожидаясь друг друга — это гонка, а не
    // последовательность. `reconnect()` перенимает соединение, которое провайдер
    // уже держит; `connect()` заводит новое и бросает
    // ConnectorAlreadyConnectedError, когда живое уже есть. Бросок безвреден:
    // `connect` — это `mutate()`, а не `mutateAsync()`, отказ проглатывается
    // внутри react-query. Вдвоём они покрывают и первое подключение, и всё ещё
    // живой провайдер, ничего не дожидаясь.
    reconnect({ connectors: [connector] });
    connect({ connector });
  }, [machine.effect, claim, connectors, connect, reconnect]);

  const settle = useCallback(
    (outcome: LadderOutcome) => dispatch({ type: "settle", outcome }),
    [],
  );

  const settleResolve = useCallback<TurnkeyIdentityValue["settleResolve"]>(
    (seq, result) => {
      if (result.ok) {
        // Пишется до диспатча, который делает это читаемым, и адресуется тем же
        // `seq`: seq-проверка `ladderSettle` защищает состояние, а не эту
        // ссылку. `holdAccount` — вторая половина: монотонность по `seq` не даёт
        // позднему приземлению отменённой попытки затереть живое.
        accountRef.current = holdAccount(accountRef.current, seq, result.account);
        dispatch({
          type: "settle",
          outcome: { step: "resolve", ok: true, seq, address: result.address },
        });
        return;
      }
      dispatch({
        type: "settle",
        outcome: { step: "resolve", ok: false, seq, error: result.error },
      });
    },
    [],
  );

  const retryResolve = useCallback(() => dispatch({ type: "retry" }), []);

  const value = useMemo<TurnkeyIdentityValue>(
    () => ({
      state: machine.state,
      effect: machine.effect,
      // Выводится, а не читается сырьём: сброс чистит `accountRef` без диспатча,
      // и мемо, ключённое на одну ссылку, продолжало бы отдавать подписанта
      // предыдущей личности до следующего перехода.
      account: heldAccountIsCurrent(machine.state, accountRef.current?.seq)
        ? accountRef.current?.account
        : undefined,
      embedded: embeddedWalletView(machine.state),
      subOrgId,
      claim,
      settle,
      settleResolve,
      retryResolve,
      silentSigner,
    }),
    [machine.state, machine.effect, subOrgId, claim, settle, settleResolve, retryResolve, silentSigner],
  );

  return (
    <TurnkeyIdentityContext.Provider value={value}>
      {children}
    </TurnkeyIdentityContext.Provider>
  );
}
```

- [ ] **Step 4: Написать раннеры**

```tsx
// src/features/auth/EmbeddedWalletRunner.tsx
import { createEmbeddedWallet } from "@liq/turnkey";
import { useEffect } from "react";

import { env } from "../../config/env";
import { useTurnkeyIdentity } from "./TurnkeyIdentityProvider";

/**
 * Разрешает встроенный кошелёк суб-организации — один раз на личность.
 *
 * @remarks
 * Ничего не рисует и ничем не владеет. Гарантию «не более одного раза» даёт
 * отметка `attempts.resolve` плюс `claim()`, а не модульный промис:
 * `createEmbeddedWallet` — это fetch-or-create, и два одновременных разрешения
 * суб-организации без кошелька создадут два кошелька там, где
 * `SnxAccount.owner` — записываемый однажды и не переписываемый — может назвать
 * только один. Аккаунт проигравшего недостижим навсегда.
 */
export function EmbeddedWalletRunner() {
  const { effect, claim, settleResolve } = useTurnkeyIdentity();

  useEffect(() => {
    if (effect.kind !== "resolve-signer") return;
    if (!claim(effect)) return;
    const seq = effect.seq;
    createEmbeddedWallet({
      orgId: env.turnkey.orgId,
      authProxyUrl: env.turnkey.authProxyUrl,
      authProxyConfigId: env.turnkey.authProxyConfigId,
    })
      .then((wallet) =>
        settleResolve(seq, { ok: true, address: wallet.address, account: wallet.account }),
      )
      .catch((error: unknown) => settleResolve(seq, { ok: false, error }));
    // Флага `cancelled` нет намеренно: приземление, чей seq больше не совпадает
    // с записанной попыткой, отбрасывается дважды — `ladderSettle` отказывает
    // диспатчу, а `heldAccountIsCurrent` отказывается показывать аккаунт, даже
    // если его успели записать в ссылку. Этим покрыты и размонтирование, и
    // выход, и повтор.
  }, [effect, claim, settleResolve]);

  return null;
}
```

```tsx
// src/features/auth/GasGrantRunner.tsx
import { useEffect } from "react";

import { env } from "../../config/env";
import { requestGasGrant } from "../wallet/gasGrant";
import { useTurnkeyIdentity } from "./TurnkeyIdentityProvider";

/**
 * Просит шлюз налить газа встроенному кошельку — один раз на личность, до
 * создания аккаунта.
 *
 * @remarks
 * Подписывает сам встроенный аккаунт, минуя wagmi: попапа нет, анклав
 * подписывает молча. Исход не блокирует лестницу — `requestGasGrant` не бросает,
 * а «не налили» это обычный ответ вернувшемуся пользователю.
 */
export function GasGrantRunner() {
  const { effect, claim, settle, account, subOrgId } = useTurnkeyIdentity();

  useEffect(() => {
    if (effect.kind !== "gas") return;
    if (!account || !subOrgId) return;
    if (!claim(effect)) return;
    const seq = effect.seq;
    void requestGasGrant({
      gatewayUrl: env.gatewayUrl,
      address: effect.address,
      subOrgId,
      signMessage: ({ message }) => account.signMessage({ message }),
    }).then((outcome) => settle({ step: "gas", seq, outcome }));
  }, [effect, claim, settle, account, subOrgId]);

  return null;
}
```

- [ ] **Step 5: Смонтировать в `LiqSetup`**

В `src/providers/LiqSetup.tsx`: добавить импорт стилей кита и собрать поддерево. Существующий комментарий про `sessionKey` сохранить.

```tsx
// Единственный прямой импорт `@turnkey/*` в приложении, и намеренно. Опасность
// двух копий, вокруг которой всё выстроено, — про слой хранения SDK: две копии
// JS делят ключи `@turnkey/session/v3` в localStorage и портят сессии друг
// друга. Таблица стилей не инстанцирует ничего, а подпуть разрешается в ту же
// единственную поднятую копию, которой пользуется сам `@liq/turnkey`. Без него
// модалка входа рендерится без стилей: в dev кит подменяет её экраном
// «стили не найдены», в prod она просто выглядит сломанной.
import "@turnkey/react-wallet-kit/styles.css";
```

```tsx
  const { enabled, orgId, authProxyUrl, authProxyConfigId } = env.turnkey;
  const { methods, methodOrder } = turnkeyAuthMethods();
  // Обёртка нужна и сессионным ключам, и двери входа — поднимаем её, если хоть
  // одно из двух включено и конфиг на месте. Прежнее условие смотрело только на
  // флаг сессионных ключей, то есть вход без них был бы невозможен.
  const mounted = Boolean(orgId) && (enabled || turnkeyLoginEnabled);

  const inner = mounted ? (
    <TurnkeyIdentityProvider>
      <EmbeddedWalletRunner />
      <GasGrantRunner />
      {children}
    </TurnkeyIdentityProvider>
  ) : (
    children
  );

  const provider = (
    <LiqProvider client={liqClient} onchain={liqOnchain} sessionKey={env.turnkey}>
      {inner}
    </LiqProvider>
  );

  if (!mounted) return provider;

  return (
    <TurnkeyProviderWrapper
      orgId={orgId}
      authProxyUrl={authProxyUrl}
      authProxyConfigId={authProxyConfigId}
      walletConnectProjectId={env.walletConnectId || undefined}
      chainIds={[String(env.chainId)]}
      authMethods={methods}
      methodOrder={methodOrder}
      provisionEmbeddedWallet
      appName="Liq"
      // Обязан быть ORIGIN'ом ЭТОЙ сборки, а не постоянным доменом: он
      // становится `appMetadata.url` у WalletConnect, и кошелёк показывает его
      // в листе подтверждения. Прибитый домен заставлял каждый preview-деплой
      // называться продакшеном — WalletConnect предупреждает о расхождении, а
      // пользователю это читается как фишинг.
      appUrl={window.location.origin}
    >
      {provider}
    </TurnkeyProviderWrapper>
  );
```

Порядок вложенности здесь несущий и остаётся прежним: `TurnkeyProviderWrapper` снаружи `LiqProvider`, потому что `LiqProvider` с пропом `sessionKey` зовёт `useSessionKeyManager`, которому нужен контекст обёртки сверху. `TurnkeyIdentityProvider` при этом стоит ВНУТРИ `LiqProvider` — то есть внутри обоих контекстов сразу.

- [ ] **Step 6: Прогнать всё**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.

- [ ] **Step 7: Прогнать полный tier1 — флаг выключен, поведение обязано быть прежним**

Run: `pnpm test:e2e`
Expected: PASS, 29 спек.

- [ ] **Step 8: Коммит**

```bash
git add src/features/auth/TurnkeyIdentityProvider.tsx src/features/auth/EmbeddedWalletRunner.tsx src/features/auth/GasGrantRunner.tsx src/features/auth/useSessionStage.ts src/features/auth/SessionGate.tsx src/providers/LiqSetup.tsx
git commit -m "feat(auth): мост Turnkey → wagmi, разрешение встроенного кошелька и долив газа"
```

---

### Task 9: Экран входа с двумя дверьми, выход и документация

**Files:**
- Create: `src/features/auth/SignInPanel.tsx`
- Create: `src/features/auth/TurnkeyLoginButton.tsx`
- Modify: `src/features/auth/SessionGate.tsx`
- Modify: `src/features/wallet/ConnectButton.tsx`
- Create: `e2e/tier1/30-login-doors.spec.ts`
- Modify: `e2e/pages/AppPage.ts`
- Modify: `src/__tests__/__snapshots__/testid-inventory.test.ts.snap`
- Modify: `README.md`

**Interfaces:**
- Consumes: `turnkeyLoginEnabled`, `env.turnkeyConfigError` (задача 1), `useIdentityDoor` (задача 4), `useTurnkeyIdentity` (задача 8).
- Produces: `data-testid` `turnkey-login-button`, `auth-config-error`, `auth-login-error`, `auth-embedded-failed`, `auth-provider-stalled`.

- [ ] **Step 1: Написать кнопку Turnkey**

```tsx
// src/features/auth/TurnkeyLoginButton.tsx
import { humanizeError } from "@liq/core";
import { AuthState, useTurnkey } from "@liq/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useIdentityDoor } from "./IdentityDoorProvider";
import { useTurnkeyIdentity } from "./TurnkeyIdentityProvider";

/**
 * Дверь Turnkey: одна кнопка, за которой модалка выбирает способ входа.
 *
 * @remarks
 * Отдельный компонент, а не ветка внутри `SignInPanel`, ровно потому, что зовёт
 * `useTurnkey()` — тот бросает вне своего провайдера. Условие монтирования у
 * вызывающего — константа времени сборки, значит эта ветка не меняется за время
 * монтирования и правило хуков соблюдено.
 */
export function TurnkeyLoginButton() {
  const { handleLogin, authState } = useTurnkey();
  const { embedded, retryResolve } = useTurnkeyIdentity();
  const { setDoor } = useIdentityDoor();
  const [loginError, setLoginError] = useState<unknown>(null);
  const [stalled, setStalled] = useState(false);

  // Вошли в Turnkey, а подписанта всё нет: сдвинуть сессию нечему, и вместо
  // молчащей кнопки нужно сказать об этом вслух. Ждать имеет смысл только
  // разрешения встроенного кошелька — он единственный подписант обеих дверей.
  const awaiting =
    authState === AuthState.Authenticated &&
    (embedded.kind === "resolving" || embedded.kind === "idle");

  useEffect(() => {
    if (!awaiting) {
      setStalled(false);
      return;
    }
    const timer = window.setTimeout(() => setStalled(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [awaiting]);

  return (
    <>
      <Button
        type="button"
        disabled={awaiting}
        onClick={() => {
          setLoginError(null);
          // Дверь пишется до модалки: перезагрузка посреди входа должна
          // восстанавливать Turnkey, а не подхватывать расширение.
          setDoor("turnkey");
          handleLogin().catch((error: unknown) => setLoginError(error));
        }}
        data-testid="turnkey-login-button"
      >
        {awaiting ? "Opening wallet…" : "Continue with email"}
      </Button>

      {loginError ? (
        <p className="text-sm text-short" role="alert" data-testid="auth-login-error">
          {humanizeError(loginError)}
        </p>
      ) : null}

      {embedded.kind === "failed" ? (
        <p className="text-sm text-short" role="alert" data-testid="auth-embedded-failed">
          We could not open your wallet.{" "}
          <button type="button" className="underline" onClick={retryResolve}>
            Try again
          </button>
        </p>
      ) : null}

      {stalled ? (
        <p className="text-sm text-short" role="alert" data-testid="auth-provider-stalled">
          Your wallet is not responding. Reload the page and connect again.
        </p>
      ) : null}
    </>
  );
}
```

- [ ] **Step 2: Написать панель входа**

```tsx
// src/features/auth/SignInPanel.tsx
import { env, turnkeyLoginEnabled } from "../../config/env";
import { ConnectButton } from "../wallet/ConnectButton";
import { TurnkeyLoginButton } from "./TurnkeyLoginButton";

/**
 * Экран входа: две двери в одну и ту же сессию.
 *
 * @remarks
 * Turnkey даёт встроенный кошелёк в TEE и не требует расширения; `injected`
 * оставлен как есть. Обе приводят в один и тот же `SessionGate` — дальше
 * терминал не различает, чем подписывают.
 */
export function SignInPanel() {
  return (
    <div className="flex flex-col items-center gap-3">
      {turnkeyLoginEnabled ? <TurnkeyLoginButton /> : null}

      {env.turnkeyConfigError ? (
        <p className="text-sm text-short" role="alert" data-testid="auth-config-error">
          {env.turnkeyConfigError}
        </p>
      ) : null}

      <ConnectButton />
    </div>
  );
}
```

- [ ] **Step 3: Подключить панель к гейту**

В `src/features/auth/SessionGate.tsx` заменить содержимое ветки `disconnected`:

```tsx
  if (stage === "disconnected") {
    return (
      <Centered testid="session-disconnected">
        <SignInPanel />
      </Centered>
    );
  }
```

и заменить импорт `ConnectButton` на `SignInPanel`.

- [ ] **Step 4: Сделать выход зависящим от двери**

`src/features/wallet/ConnectButton.tsx` целиком:

```tsx
import { useLiqSignOut, useTurnkey } from "@liq/react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

import { Button } from "@/components/ui/button";
import { turnkeyLoginEnabled } from "../../config/env";
import { INJECTED_CONNECTOR_ID } from "../auth/identityDoor";
import { useIdentityDoor } from "../auth/IdentityDoorProvider";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Разметка кнопки адреса. Что делает клик — решают две обёртки ниже. */
function AddressButton({
  address,
  onSignOut,
}: {
  address: string;
  onSignOut: () => void;
}) {
  return (
    <button
      onClick={onSignOut}
      className="rounded-[var(--radius-sm)] border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-text"
      title="Disconnect"
      data-testid="wallet-address-button"
    >
      {short(address)}
    </button>
  );
}

/**
 * Выход из сессии, открытой расширением.
 *
 * @remarks
 * Просто `disconnect()`: токен шлюза переживает отключение, поэтому
 * переподключение того же кошелька возвращает в терминал без второго SIWE.
 */
function PlainAddressButton({ address }: { address: string }) {
  const { disconnect } = useDisconnect();
  const { forgetDoor } = useIdentityDoor();
  return (
    <AddressButton
      address={address}
      onSignOut={() => {
        forgetDoor();
        disconnect();
      }}
    />
  );
}

/**
 * Выход в сборке, где есть дверь Turnkey. Асимметрия с `PlainAddressButton`
 * намеренная.
 *
 * @remarks
 * Под Turnkey одного `disconnect()` мало: сессия Turnkey остаётся живой, мост
 * видит «аутентифицирован + живой провайдер + отключённый wagmi» и немедленно
 * возвращает пользователя внутрь — кнопка «выйти» не работала бы вовсе.
 * Поэтому там полный выход, и порядок внутри `useLiqSignOut` несущий: реестр
 * провайдеров пустеет первым, потому что `logout()` асинхронен и окно между
 * `disconnect()` и его разрешением — это и есть окно для такого возврата.
 */
function TurnkeyAwareAddressButton({ address }: { address: string }) {
  const { logout } = useTurnkey();
  const signOut = useLiqSignOut();
  const { disconnect } = useDisconnect();
  const { door, forgetDoor } = useIdentityDoor();
  return (
    <AddressButton
      address={address}
      onSignOut={() => {
        forgetDoor();
        if (door === "turnkey") signOut({ logout });
        else disconnect();
      }}
    />
  );
}

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { setDoor } = useIdentityDoor();

  if (isConnected && address) {
    // Ветка стоит на константе времени сборки: `useTurnkey()` бросает вне
    // своего провайдера, поэтому выбор, способный поменяться на лету, нарушил бы
    // правило хуков. `turnkeyLoginEnabled` истинно только вместе с непустым
    // orgId, а значит обёртка Turnkey в этой сборке смонтирована.
    return turnkeyLoginEnabled ? (
      <TurnkeyAwareAddressButton address={address} />
    ) : (
      <PlainAddressButton address={address} />
    );
  }

  const connector = connectors.find((c) => c.id === INJECTED_CONNECTOR_ID);
  return (
    <Button
      disabled={isPending || !connector}
      onClick={() =>
        connector &&
        connect(
          { connector },
          // Дверь пишется по факту подключения, а не по клику: отменённый в
          // расширении коннект не должен оставлять дверь, которую следующая
          // загрузка попробует восстановить.
          { onSuccess: () => setDoor("injected") },
        )
      }
      data-testid="connect-wallet-button"
    >
      {isPending ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}
```

- [ ] **Step 5: Написать e2e-спек**

```ts
// e2e/tier1/30-login-doors.spec.ts
import { AppPage } from "../pages/AppPage";
import { expect, seed, test } from "../support/fixtures";
import { readyWorld } from "../support/world";

test.describe("двери входа", () => {
  test("без конфига Turnkey экран входа предлагает только кошелёк", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    const app = new AppPage(page);
    await app.goto();

    await expect(app.disconnectedGate).toBeVisible();
    await expect(app.connectButton.first()).toBeVisible();
    // Дверь Turnkey за флагом, а tier1 гоняется без него: кнопки быть не должно,
    // как и жалобы на неполный конфиг.
    await expect(app.turnkeyLoginButton).toHaveCount(0);
    await expect(app.authConfigError).toHaveCount(0);
  });

  test("дверь кошелька по-прежнему доводит до терминала", async ({ page, world }) => {
    seed(world, readyWorld());
    const app = new AppPage(page);
    await app.goto();
    await app.signInToTerminal();
    await expect(app.terminal).toBeVisible();
  });
});
```

В `e2e/pages/AppPage.ts` добавить два локатора рядом с существующими:

```ts
  readonly turnkeyLoginButton: Locator;
  readonly authConfigError: Locator;
```

```ts
    this.turnkeyLoginButton = page.getByTestId("turnkey-login-button");
    this.authConfigError = page.getByTestId("auth-config-error");
```

- [ ] **Step 6: Обновить инвентарь testid**

Run: `pnpm test src/__tests__/testid-inventory.test.ts -u`
Затем убедиться глазами, что в дифф снапшота добавились ровно пять новых идентификаторов и **ничего не пропало**: `auth-config-error`, `auth-embedded-failed`, `auth-login-error`, `auth-provider-stalled`, `turnkey-login-button`.

Run: `git diff src/__tests__/__snapshots__`
Expected: только добавления.

- [ ] **Step 7: Прогнать всё**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`
Expected: PASS — 30 спек tier1.

- [ ] **Step 8: Дописать README**

В таблице «Trade lifecycle ↔ SDK calls» заменить строку `Connect` на две:

```markdown
| Sign in (Turnkey)        | код на почту / подпись кошелька → встроенный кошелёк в TEE | `TurnkeyProviderWrapper`, `createEmbeddedWallet` | `features/auth/TurnkeyLoginButton.tsx`      |
| Connect (wallet)         | wagmi wallet connect                              | wagmi `useConnect`                             | `features/wallet/ConnectButton.tsx`         |
```

И в Quickstart, после шага 2, добавить абзац:

```markdown
> **Вход через Turnkey (необязательно).** По умолчанию единственная дверь — расширение браузера.
> Чтобы пустить пользователей без кошелька, задайте `VITE_TURNKEY_LOGIN=true` вместе с
> `VITE_TURNKEY_ORG_ID` и `VITE_TURNKEY_AUTH_PROXY_CONFIG_ID` из дашборда Turnkey (раздел Wallet
> Kit). Вход по коду на почту создаёт пользователю кошелёк в TEE; шлюз доливает ему газа на первую
> транзакцию через `POST /auth/gas` — на деплое без этой ручки вход работает, но ETH придётся
> прислать самому.
```

- [ ] **Step 9: Коммит**

```bash
git add src/features/auth/SignInPanel.tsx src/features/auth/TurnkeyLoginButton.tsx src/features/auth/SessionGate.tsx src/features/wallet/ConnectButton.tsx src/__tests__/__snapshots__ e2e/tier1/30-login-doors.spec.ts e2e/pages/AppPage.ts README.md
git commit -m "feat(auth): экран входа с двумя дверьми и выход, зависящий от двери"
```

---

## Проверка вручную перед PR

Юниты и tier1 гоняются без конфига Turnkey, поэтому саму дверь надо открыть руками — один раз, на staging:

- [ ] Заполнить `.env` (`VITE_TURNKEY_LOGIN=true`, org-id, auth-proxy-config-id), `pnpm dev`.
- [ ] Вход по коду на почту: модалка открывается, после кода появляется адрес встроенного кошелька, экран доходит до `Create Account` без попапа кошелька.
- [ ] Перезагрузка на этом месте возвращает в ту же точку, а не на экран входа и **не под адресом расширения**.
- [ ] `Create Account` проходит — то есть газ долили. Если нет, посмотреть в Network `POST /auth/gas`.
- [ ] Выход из шапки: экран входа, повторный вход по почте даёт тот же адрес.
- [ ] Выключить флаг, перезагрузить: кнопки Turnkey нет, вход расширением работает как раньше.
