import { TURNKEY_CONNECTOR_ID } from "@liq/turnkey";

/**
 * Захардкожен, а не импортирован: `@wagmi/core` экспортирует саму фабрику
 * `injected()`, но не константу её `id` — в публичном экспорте
 * (`@wagmi/core/dist/esm/exports/index.js`) её нет. Значение проверено там,
 * где оно единственный раз объявлено — `@wagmi/core/dist/esm/connectors/
 * injected.js` (`id: 'injected'`).
 */
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
