import { DecimalInput } from "../../components/ui/DecimalInput";

/**
 * Цена ордера с кнопкой `MID`.
 *
 * @remarks Кнопка неактивна, когда середины нет: подставить ноль значило бы
 * выдать отсутствие цены за цену.
 */
export function OrderPriceField({
  value,
  onChange,
  onMid,
  midDisabled,
  maxDecimals,
}: {
  value: string;
  onChange: (v: string) => void;
  onMid: () => void;
  /** Середины нет — подставлять нечего. */
  midDisabled: boolean;
  maxDecimals: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[10px] uppercase text-muted">Order price</label>
        <button
          type="button"
          onClick={onMid}
          disabled={midDisabled}
          className="text-[10px] font-medium text-accent disabled:opacity-40"
          data-testid="mid-price-button"
        >
          MID
        </button>
      </div>
      <DecimalInput
        value={value}
        onValueChange={onChange}
        maxDecimals={maxDecimals}
        placeholder="0.00"
        data-testid="limit-price-input"
      />
    </div>
  );
}
