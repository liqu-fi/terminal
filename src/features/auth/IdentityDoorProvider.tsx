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
  const { reconnectAsync } = useReconnect();
  const [door, setDoorState] = useState<IdentityDoor | null>(() =>
    readDoor(window.localStorage),
  );
  // Коннектор для восстановления решается сразу, вместе с чтением двери, а не
  // в эффекте: план не меняется за жизнь вкладки (дверь трогают только явные
  // `setDoor`/`forgetDoor`, а они восстановление повторно не запускают), а
  // синхронный `setBooting` внутри эффекта запрещён правилом
  // `react-hooks/set-state-in-effect` — оно бережёт от лишнего кадра рендера
  // со старым значением (тот же приём в useBookTick.ts/useTradesTape.ts).
  const [reconnectConnector] = useState(() => {
    const plan = reconnectPlan(door, config.connectors.map((c) => c.id));
    return plan ? (config.connectors.find((c) => c.id === plan) ?? null) : null;
  });
  // Дверь есть и коннектор для неё нашёлся — значит восстанавливать что-то
  // будем, и до завершения этого процесса экран входа показывать нельзя.
  // Иначе (двери нет или конфиг собран без её коннектора) грузиться нечему.
  const [booting, setBooting] = useState(() => reconnectConnector !== null);
  const started = useRef(false);

  useEffect(() => {
    // Ровно один запуск на монтирование: StrictMode прогоняет setup дважды, а
    // повторный вызов reconnect был бы лишней попыткой подключения поверх уже
    // идущей.
    if (started.current) return;
    started.current = true;
    if (!reconnectConnector) return;
    // `reconnectAsync` (mutateAsync), а не `reconnect` (mutate) с колбэком
    // `onSettled`: `useReconnect()` пересобирает `mutationOptions` без
    // мемоизации на каждый рендер, а компонент успевает перерендериться, пока
    // подключение ещё в процессе (сам wagmi обновляет account-стейт раньше,
    // чем резолвится промис). Колбэк `mutate`, привязанный к наблюдателю
    // `useMutation`, в этой гонке терялся — `onSettled` не вызывался никогда,
    // и `booting` оставался `true` навсегда. Промис `mutateAsync` от пересборки
    // наблюдателя не зависит.
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
