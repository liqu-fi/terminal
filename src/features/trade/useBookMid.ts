import { useOrderbook } from "@liq/react";
import { Price } from "@liq/sdk";

import { useSelectedMarket } from "../market/useSelectedMarket";
import { useBookTick } from "../orderbook/useBookTick";
import { useMarkPrice } from "./useMarkPrice";

/**
 * Середина спреда для кнопки `MID`.
 *
 * @remarks
 * Считается от сырых цен ДО группировки, поэтому шаг здесь любой валидный —
 * он влияет только на строки, а строк тикету не нужно (`depth: 1`). Именно
 * поэтому тикету не приходится знать, какой шаг выбрал пользователь в панели
 * стакана: собственный `useBookTick` здесь не рассинхронизируется с ней, а
 * просто не участвует в ответе.
 *
 * `null` значит «цены нет»: книга пуста и марка не пришла. Ноль на её месте
 * читался бы как измеренная цена.
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
