import { bookTickOptions, Price } from "@liq/sdk";
import { useMemo, useState } from "react";

/**
 * Выбранный шаг группировки.
 *
 * @remarks Набор шагов зависит от цены рынка, поэтому при переезде на другой
 * рынок прежний выбор может исчезнуть из списка. Тогда берётся самый мелкий
 * шаг нового набора: молча оставленный чужой шаг показывал бы книгу, которой
 * на этом рынке не бывает.
 *
 * Сброс сделан правкой состояния прямо в теле рендера (сверка с прошлым
 * `options` через отдельный стейт), а не в `useEffect`: правило
 * `react-hooks/set-state-in-effect` запрещает синхронный `setState` внутри
 * эффекта именно из-за каскада лишних рендеров, которого этот приём и
 * избегает — React донабирает состояние до коммита, без промежуточного
 * кадра со старым тиком. Паттерн — «Adjusting some state when a prop
 * changes» из React-доков.
 */
export function useBookTick(price: bigint) {
  const options = useMemo(
    () => bookTickOptions(price === 0n ? null : Price(price)),
    [price],
  );
  // Сверка по содержимому, а не по ссылке: `bookTickOptions` возвращает новый
  // массив на каждый вызов, а `options` мемоизирован по цене — значит на КАЖДОМ
  // тике марк-цены ссылка новая, даже когда набор шагов тот же. Сверка по
  // ссылке заказывала на каждый такой тик лишний проход рендера всей панели.
  const optionsKey = options.join(",");
  const [tick, setTick] = useState<bigint>(() => options[0]);
  const [prevKey, setPrevKey] = useState(optionsKey);

  if (optionsKey !== prevKey) {
    setPrevKey(optionsKey);
    if (!options.some((o) => o === tick)) setTick(options[0]);
  }

  return { tick, setTick, options };
}
