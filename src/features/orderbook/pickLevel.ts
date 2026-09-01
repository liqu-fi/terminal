import { OrderType, Price } from "@liq/sdk";
import type { TradeActions } from "@liq/react";

/**
 * Кладёт цену уровня книги в тикет как лимитный ордер.
 *
 * @remarks Порядок вызовов несущий: `setOrderType` в сторе пишет
 * `limitPrice: type === MARKET ? null : undefined`, то есть при LIMIT
 * затирает `limitPrice` в `undefined`. Сначала тип, потом цена — иначе
 * `setLimitPrice` стирается следующим же вызовом.
 *
 * Обратный порядок не виден в UI и потому не ловится e2e-тестами: мост
 * `TradeForm` подписан только на `limitPrice` стора (не на `orderType`), а
 * подписка получает уведомление синхронно на каждый вызов `set()` — первое
 * валидное значение уже применяется в локальном состоянии формы до того, как
 * следующий вызов испортит `limitPrice` в сторе. Стор при этом остаётся
 * рассогласован (`orderType` не `LIMIT` и/или `limitPrice: undefined`), просто
 * сегодня этот срез стора никто, кроме этого моста, не читает. Инвариант
 * проверяется на уровне стора юнит-тестом, а не рендером формы.
 */
export function pickLevel(
  actions: Pick<TradeActions, "setOrderType" | "setLimitPrice">,
  price: bigint,
): void {
  actions.setOrderType(OrderType.LIMIT);
  actions.setLimitPrice(Price(price));
}
