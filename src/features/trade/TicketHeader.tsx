import { PlusCircle } from "lucide-react";
import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtUsd } from "../../lib/format";
import { DepositDialog } from "../account/DepositDialog";
import { leverageSteps } from "./leverageSteps";

/**
 * Шапка тикета: выбор плеча и доступная маржа с кнопкой пополнения.
 *
 * @remarks
 * Макет ставит рядом вторую пилюлю — `Cross ▾`. Она не рисуется: режима маржи
 * в API нет, и переключатель, который ничего не переключает, обещает
 * возможность, которой у площадки нет.
 *
 * Названия валюты рядом с суммой тоже нет, хотя макет его показывает: рынок
 * котировочного символа не отдаёт (`MarketSummary` — это id, symbol, feed), а
 * `fmtUsd` уже ставит `$`. Приписать сюда слово значило бы назвать валюту,
 * источника которой в терминале не существует.
 */
export function TicketHeader({
  leverage,
  maxLeverage,
  onLeverage,
  available,
}: {
  leverage: number;
  maxLeverage: number;
  onLeverage: (l: number) => void;
  /** Доступная маржа, 18 знаков; `null` — ответа ещё нет. */
  available: bigint | null;
}) {
  const [depositOpen, setDepositOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <Select
          value={String(leverage)}
          onValueChange={(v) => onLeverage(Number(v))}
        >
          <SelectTrigger
            className="h-7 w-auto gap-1 rounded-full bg-surface-2 px-3 text-[11px]"
            data-testid="leverage-select"
          >
            <SelectValue data-testid="leverage-value">{leverage}×</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {leverageSteps(maxLeverage).map((l) => (
              <SelectItem
                key={l}
                value={String(l)}
                data-testid={`leverage-option-${l}`}
              >
                {l}×
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted">Available</span>
        <span className="flex items-center gap-2">
          <span className="text-text" data-testid="ticket-available">
            {/* Прочерк, пока ответа о марже нет: ноль читался бы как
                измеренный пустой счёт. */}
            {available === null ? "—" : fmtUsd(available)}
          </span>
          <button
            type="button"
            aria-label="Deposit"
            onClick={() => setDepositOpen(true)}
            className="text-long hover:opacity-80"
            data-testid="ticket-deposit-button"
          >
            <PlusCircle size={14} />
          </button>
        </span>
      </div>

      <DepositDialog open={depositOpen} onClose={() => setDepositOpen(false)} />
    </div>
  );
}
