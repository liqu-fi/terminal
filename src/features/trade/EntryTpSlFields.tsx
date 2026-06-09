import { DecimalInput } from "../../components/ui/DecimalInput";

/**
 * Optional take-profit / stop-loss prices attached to a Market/Limit entry.
 * When enabled, the parent submits reduce-only conditional orders after the
 * entry is accepted (best-effort — not atomic with the entry).
 */
export function EntryTpSlFields({
  enabled,
  onToggle,
  tp,
  setTp,
  sl,
  setSl,
}: {
  enabled: boolean;
  onToggle: (on: boolean) => void;
  tp: string;
  setTp: (v: string) => void;
  sl: string;
  setSl: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        className="flex items-center gap-1.5 text-[11px] text-muted hover:text-text"
        data-testid="tpsl-toggle"
        aria-pressed={enabled}
      >
        <span
          className={`inline-block h-3 w-3 rounded-[3px] border ${
            enabled ? "border-accent bg-accent" : "border-border"
          }`}
        />
        TP / SL
      </button>
      {enabled && (
        <div className="flex flex-col gap-2" data-testid="tpsl-fields">
          <div>
            <label className="mb-1 block text-[10px] uppercase text-muted">
              Take profit
            </label>
            <DecimalInput
              value={tp}
              onValueChange={setTp}
              maxDecimals={2}
              placeholder="0.00"
              data-testid="entry-tp-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase text-muted">
              Stop loss
            </label>
            <DecimalInput
              value={sl}
              onValueChange={setSl}
              maxDecimals={2}
              placeholder="0.00"
              data-testid="entry-sl-input"
            />
          </div>
        </div>
      )}
    </div>
  );
}
