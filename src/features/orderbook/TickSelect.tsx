import { Price } from "@liq/sdk";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TickSelectProps {
  tick: bigint;
  options: readonly bigint[];
  onSelect: (tick: bigint) => void;
}

/** Чип-селектор шага группировки книги — триггер печатает текущий шаг. */
export function TickSelect({ tick, options, onSelect }: TickSelectProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="book-tick-select"
        className="rounded-[var(--radius-sm)] border border-border bg-surface-2 px-2 py-0.5 text-xs text-text hover:bg-surface"
      >
        {Price.fmt(Price(tick))}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((option, i) => (
          <DropdownMenuItem
            key={option.toString()}
            data-testid={`book-tick-option-${i}`}
            onSelect={() => onSelect(option)}
          >
            {Price.fmt(Price(option))}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
