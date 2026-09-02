import {
  barPct,
  fmtBookPrice,
  fmtBookSize,
  fmtBookTotal,
  type Slot,
} from "./bookView";

interface BookRowProps {
  slot: Slot;
  side: "bid" | "ask";
  tick: bigint;
  maxTotal: bigint;
  testid: string;
  onPick?: (price: bigint) => void;
}

/**
 * Одна строка сетки книги, фиксированной высоты.
 *
 * @remarks Высота одинакова для пустого и заполненного слота — иначе высота
 * панели гуляет вместе с толщиной книги. Пустой слот получает testid вне
 * пространства `book-{ask,bid}-*`, чтобы `toHaveCount` на коллекции строк
 * считал заявки, а не размер сетки. Пустой слот никогда не становится
 * кнопкой — кликнуть там всё равно не на что.
 */
export function BookRow({
  slot,
  side,
  tick,
  maxTotal,
  testid,
  onPick,
}: BookRowProps) {
  if (slot === null) {
    return (
      <div className="h-[18px]" data-testid="book-slot-empty" aria-hidden />
    );
  }

  const priceClass = side === "bid" ? "text-long" : "text-short";
  const barClass =
    side === "bid" ? "bg-[var(--long-soft)]" : "bg-[var(--short-soft)]";

  return (
    <button
      type="button"
      onClick={() => onPick?.(slot.price)}
      className="relative grid h-[18px] w-full cursor-pointer grid-cols-3 items-center px-1 text-left text-xs hover:bg-surface-2/60"
      data-testid={testid}
    >
      <span
        className={`absolute inset-y-0 right-0 ${barClass}`}
        style={{ width: `${barPct(slot.total, maxTotal)}%` }}
        aria-hidden
      />
      <span className={`relative ${priceClass}`}>
        {fmtBookPrice(slot.price, tick)}
      </span>
      <span className="relative text-right text-text">
        {fmtBookSize(slot.size)}
      </span>
      <span className="relative text-right text-muted">
        {fmtBookTotal(slot.total)}
      </span>
    </button>
  );
}
