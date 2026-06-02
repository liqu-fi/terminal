import { Input } from "../../components/ui/Input";

export function ConditionalFields({
  triggerPrice,
  setTriggerPrice,
  triggerAbove,
  setTriggerAbove,
}: {
  triggerPrice: string;
  setTriggerPrice: (v: string) => void;
  triggerAbove: boolean;
  setTriggerAbove: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <label className="mb-1 block text-[10px] uppercase text-muted">
          Trigger price
        </label>
        <Input
          inputMode="decimal"
          value={triggerPrice}
          onChange={(e) => setTriggerPrice(e.target.value)}
          placeholder="0.00"
        />
      </div>
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          className={`flex-1 rounded-[var(--radius-sm)] py-1 ${triggerAbove ? "bg-accent text-white" : "bg-surface-2 text-muted"}`}
          onClick={() => setTriggerAbove(true)}
        >
          Trigger ≥
        </button>
        <button
          type="button"
          className={`flex-1 rounded-[var(--radius-sm)] py-1 ${!triggerAbove ? "bg-accent text-white" : "bg-surface-2 text-muted"}`}
          onClick={() => setTriggerAbove(false)}
        >
          Trigger ≤
        </button>
      </div>
    </div>
  );
}
