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

import { turnkeyLoginEnabled } from "../../config/env";
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
  const { reconnectAsync } = useReconnect();
  const [door, setDoorState] = useState<IdentityDoor | null>(() =>
    readDoor(window.localStorage),
  );
  // Дверь, записанной которой ещё нет, значит одно из двух: пользователь пришёл
  // впервые либо сессия открыта сборкой, где двери ещё не запоминались. Во втором
  // случае восстановить надо ровно то, что восстанавливалось всегда, — иначе
  // первая загрузка после деплоя выкинет на экран входа каждого, кто уже вошёл.
  // Там, где дверей две, гадать нельзя: остаёмся детерминированными.
  const effectiveDoor = door ?? (turnkeyLoginEnabled ? null : "injected");
  // Коннектор для восстановления решается сразу, вместе с чтением двери, а не
  // в эффекте: план не меняется за жизнь вкладки (дверь трогают только явные
  // `setDoor`/`forgetDoor`, а они восстановление повторно не запускают), а
  // синхронный `setBooting` внутри эффекта запрещён правилом
  // `react-hooks/set-state-in-effect` — оно бережёт от лишнего кадра рендера
  // со старым значением (тот же приём в useBookTick.ts/useTradesTape.ts).
  const [reconnectConnector] = useState(() => {
    const plan = reconnectPlan(effectiveDoor, config.connectors.map((c) => c.id));
    return plan ? (config.connectors.find((c) => c.id === plan) ?? null) : null;
  });
  // Дверь есть и коннектор для неё нашёлся — значит восстанавливать что-то
  // будем, и до завершения этого процесса экран входа показывать нельзя.
  // Иначе (двери нет или конфиг собран без её коннектора) грузиться нечему.
  const [booting, setBooting] = useState(() => reconnectConnector !== null);
  const started = useRef(false);

  useEffect(() => {
    // Ровно один запуск на монтирование: `@wagmi/core`'s reconnect() держит
    // МОДУЛЬНЫЙ (не per-config) флаг `isReconnecting` — повторный вызов, пока
    // первый ещё не отработал, мгновенно резолвится пустым массивом. Без
    // этого гварда `.finally` второго вызова погасил бы `booting` раньше
    // срока, и StrictMode, прогоняющий setup дважды, подсунул бы именно
    // такой второй вызов — гейт мигнул бы экраном входа посреди
    // восстановления.
    if (started.current) return;
    started.current = true;
    if (!reconnectConnector) return;
    // `reconnectAsync` (mutateAsync), а не `reconnect` (mutate) с колбэком
    // `onSettled`: колбэки `mutate` живут на MutationObserver и переживают
    // только его подписку. `useSyncExternalStore` внутри `useMutation`
    // подписывается на монтировании — а `<StrictMode>` (src/main.tsx) на
    // монтировании же прогоняет чистовой teardown пассивных эффектов, и
    // `MutationObserver.onUnsubscribe()` тут же отвязывает наблюдателя от
    // ЛЕТЯЩЕЙ мутации (`removeObserver`). Назад, к уже начатой мутации,
    // `onSubscribe` не привязывает — `Subscribable.onSubscribe` пуст. Мутация
    // потом реально резолвится, но `#notify` проверяет `hasListeners()` и уже
    // не находит слушателя — `onSettled` не звонит никогда, `booting`
    // остаётся `true` навсегда. У промиса `mutateAsync` такой привязки к
    // подписке нет — он резолвится независимо от неё.
    reconnectAsync({ connectors: [reconnectConnector] })
      .catch(() => {
        // Восстановление не обязано увенчаться успехом — коннектор мог
        // протухнуть между сессиями. Тогда просто увидим экран входа.
      })
      .finally(() => setBooting(false));
  }, [reconnectConnector, reconnectAsync]);

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
