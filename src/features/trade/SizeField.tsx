import { DecimalInput } from "../../components/ui/DecimalInput";
import type { SizeUnit } from "./useOrderSizing";

/**
 * Order-size input with an in-field unit toggle (base asset ⇄ USD) and a Max
 * button. The text field keeps the `size-input` testid; default unit is the
 * base asset so a bare `0.5` means 0.5 contracts.
 */
export function SizeField({
  value,
  onChange,
  unit,
  onToggleUnit,
  onMax,
  baseSymbol,
  invalid,
  toggleDisabled,
}: {
  value: string;
  onChange: (v: string) => void;
  unit: SizeUnit;
  onToggleUnit: () => void;
  onMax: () => void;
  baseSymbol: string;
  invalid?: boolean;
  /** Disable the unit toggle (no mark price → no base⇄USD conversion). */
  toggleDisabled?: boolean;
}) {
  const unitLabel = unit === "base" ? baseSymbol || "BASE" : "USD";
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase text-muted">Size</label>
      <DecimalInput
        value={value}
        onValueChange={onChange}
        maxDecimals={unit === "base" ? 8 : 2}
        invalid={invalid}
        placeholder="0.00"
        data-testid="size-input"
        rightSlot={
          <>
            <button
              type="button"
              onClick={onToggleUnit}
              disabled={toggleDisabled}
              className="rounded-[var(--radius-sm)] bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted hover:text-text disabled:opacity-40"
              data-testid="size-unit-toggle"
              title="Toggle size unit"
            >
              {unitLabel} ⇄
            </button>
            <button
              type="button"
              onClick={onMax}
              className="rounded-[var(--radius-sm)] bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-accent hover:brightness-110"
              data-testid="size-max-button"
            >
              MAX
            </button>
          </>
        }
      />
    </div>
  );
}
