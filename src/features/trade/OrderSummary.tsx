import { fmtPrice, fmtQty, fmtUsd } from "../../lib/format";
import type { TicketSummary } from "./ticketSummary";

/**
 * Сводка тикета парой значений — как в макете.
 *
 * @remarks Первые три строки у обеих сторон совпадают по величине и различаются
 * только цветом: это один расчёт, показанный под оба исхода. `Liq. Price` —
 * единственная строка, где числа действительно разные, и потому единственная
 * без зелёно-красной подсветки.
 *
 * Блок показан всегда, а не от непустого размера: сторона теперь выбирается
 * нажатием кнопки, и сводка — единственное место, где видно, чем два нажатия
 * различаются. Появляясь только с размером, она прятала бы это различие ровно
 * тогда, когда его и разглядывают.
 */
export function OrderSummary({
  summary,
  baseSymbol,
  quoteSymbol,
}: {
  summary: TicketSummary;
  baseSymbol: string;
  quoteSymbol: string;
}) {
  const dash = "—";
  const liq = (v: bigint | null) => (v === null ? dash : fmtPrice(v));
  return (
    <div
      className="flex flex-col gap-1 rounded-[var(--radius-sm)] border border-border bg-surface-2 p-2 text-[11px]"
      data-testid="order-summary"
    >
      <Paired
        label="Order qty."
        value={fmtQty(summary.qty)}
        unit={baseSymbol}
        testid="order-qty"
      />
      <Paired
        label="Order value"
        value={fmtUsd(summary.value)}
        unit={quoteSymbol}
        testid="order-value"
      />
      <Paired
        label="Cost"
        value={fmtUsd(summary.cost)}
        unit={quoteSymbol}
        testid="order-cost"
      />
      <div className="flex justify-between">
        <span className="text-muted">Liq. Price</span>
        <span className="text-text" data-testid="order-liq-price">
          {liq(summary.long.liqPrice)} / {liq(summary.short.liqPrice)}
        </span>
      </div>
    </div>
  );
}

/**
 * Строка, где обе стороны дают одно число.
 *
 * @remarks Число печатается дважды намеренно: пара «зелёное / красное» —
 * это и есть язык макета, и одиночное значение читалось бы как относящееся
 * к какой-то одной стороне.
 */
function Paired({
  label,
  value,
  unit,
  testid,
}: {
  label: string;
  value: string;
  unit: string;
  testid: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span data-testid={testid}>
        <span className="text-long">{value}</span>
        <span className="text-muted"> / </span>
        <span className="text-short">{value}</span>
        <span className="text-muted"> {unit}</span>
      </span>
    </div>
  );
}
