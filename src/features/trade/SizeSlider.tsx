import { Slider } from "@/components/ui/slider";

const STOPS = [0, 25, 50, 75, 100] as const;

/**
 * Доля покупательной способности — ползунок с четвертными остановками.
 *
 * @remarks Шаг 25 применяется к вводу, а не к показу: набранный руками размер
 * даёт произвольный процент, и ползунок между точками честно говорит, где он
 * стоит. Округлять его до ступени значило бы показать не тот размер, который
 * уйдёт в ордер.
 */
export function SizeSlider({
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
      <div className="mb-2 flex justify-between text-[10px] uppercase text-muted">
        <span>Amount</span>
        <span className="text-text" data-testid="size-pct-value">
          {Math.round(pct)}%
        </span>
      </div>
      <div className="relative" data-testid="size-pct-slider">
        <Slider
          min={0}
          max={100}
          step={25}
          value={[Math.round(pct)]}
          disabled={disabled}
          onValueChange={([v]) => onPct(v)}
          aria-label="Order size percent"
        />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2">
          {STOPS.map((s) => (
            <span
              key={s}
              style={{ left: `${s}%` }}
              className="absolute size-1 -translate-x-1/2 rounded-full bg-border"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
