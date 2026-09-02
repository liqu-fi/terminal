import type { SettlementLedgerRow } from "@liq/api-client";
import { useAccountId, useSettlementLedgerQuery } from "@liq/react";

/** Сколько строк леджера тянет нижняя панель за раз. */
const PAGE = 100;

/**
 * Страница расчётного леджера — общая для вкладок Account History и Funding
 * History.
 *
 * @remarks Обе вкладки читают один и тот же запрос с одними параметрами,
 * поэтому в react-query это одна запись кэша и один поход на шлюз: переключение
 * между вкладками не стоит ничего. `totals`/`coverage` первой страницы здесь не
 * используются — панель не показывает сводов.
 */
export function useAccountLedger(): {
  rows: SettlementLedgerRow[];
  isLoading: boolean;
} {
  const accountId = useAccountId();
  const { data, isLoading } = useSettlementLedgerQuery(accountId, {
    limit: PAGE,
  });
  return { rows: data?.rows ?? EMPTY, isLoading };
}

/**
 * Строки, в которых фандинг действительно двигал залог.
 *
 * @remarks `null` выбрасывается вместе с нулём, но по другой причине: ноль —
 * доказанное «платежа не было», `null` — «доказать не удалось». Ни то ни другое
 * не платёж, а вкладка обещает список платежей.
 */
export function fundingRows(
  rows: SettlementLedgerRow[],
): SettlementLedgerRow[] {
  return rows.filter(
    (r) => r.accruedFunding !== null && r.accruedFunding !== 0n,
  );
}

const EMPTY: SettlementLedgerRow[] = [];
