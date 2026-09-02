import type { ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Одна ячейка шапки: подпись сверху, значение снизу.
 *
 * @param note - почему значение такое, какое есть. Тултип появляется только
 * там, где источника нет вовсе, — иначе прочерк читается как поломка.
 */
export function MarketStat({
  label,
  testid,
  note,
  children,
}: {
  label: string;
  testid: string;
  note?: string;
  children: ReactNode;
}) {
  const value = (
    <span
      className="text-xs font-semibold text-text tabular-nums"
      data-testid={testid}
    >
      {children}
    </span>
  );
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted">{label}</span>
      {note ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">{value}</span>
          </TooltipTrigger>
          <TooltipContent>{note}</TooltipContent>
        </Tooltip>
      ) : (
        value
      )}
    </div>
  );
}
