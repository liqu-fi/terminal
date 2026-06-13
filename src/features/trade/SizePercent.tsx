const CHIPS = [25, 50, 75, 100] as const;

/**
 * "How much to open" control: a 0–100% slider over buying power plus quick
 * chips. Percentage is derived from the current size, so the slider reflects
 * typed values too. Driving it writes a base/USD size back up via `onPct`.
 */
export function SizePercent({
  pct,
  onPct,
  disabled,
}: {
  pct: number;
  onPct: (p: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] uppercase text-muted">
        <span>Amount</span>
        <span className="text-text" data-testid="size-pct-value">
          {Math.round(pct)}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(pct)}
        disabled={disabled}
        data-testid="size-pct-slider"
        onChange={(e) => onPct(Number(e.target.value))}
        className="w-full accent-accent disabled:opacity-40"
      />
      <div className="mt-1 flex gap-1">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            onClick={() => onPct(c)}
            className="flex-1 rounded-[var(--radius-sm)] bg-surface-2 py-1 text-[10px] text-muted hover:text-text disabled:opacity-40"
            data-testid={`size-pct-${c}`}
          >
            {c === 100 ? "Max" : `${c}%`}
          </button>
        ))}
      </div>
    </div>
  );
}
