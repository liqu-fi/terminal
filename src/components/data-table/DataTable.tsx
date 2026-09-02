import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type RowData,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";
import { useContext, useState } from "react";
import { createPortal } from "react-dom";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DataTableToolbar, type ToolbarMarket } from "./DataTableToolbar";
import { ALL_MARKETS, features } from "./features";
import { ToolbarSlotContext } from "./ToolbarSlotContext";

/** Идентификатор колонки, по которой фильтруют рынок. Один во всех таблицах. */
export const MARKET_COLUMN_ID = "market";

export interface DataTableProps<T extends RowData> {
  data: T[];
  columns: ColumnDef<typeof features, T, any>[];
  /** Корневой `data-testid`; из него же выводятся `-empty` и `-loading`. */
  testid: string;
  rowId: (row: T) => string;
  markets: ToolbarMarket[];
  loading?: boolean;
  /** Сообщение вместо таблицы: пусто, ошибка, источник молчит. */
  notice?: { testid: string; text: string } | null;
  emptyText: string;
  /** Кнопка фуллскрина — её владелец панель, а не таблица. */
  toolbarExtra?: ReactNode;
}

/**
 * Одна механика на семь вкладок: сортировка кликом по шапке, видимость колонок,
 * фильтр по рынку.
 *
 * @remarks Состояние держит React, а не таблица: `useTable` в v9 отдаёт слайс
 * во владение тому, кто передал пару `state` + `on…Change`, и оба обязаны быть
 * названы вместе — один только колбэк оставил бы значение неписанным.
 *
 * Тулбар уезжает порталом в `ToolbarSlotContext`, когда слот есть: по макету он
 * стоит в строке табов, а принадлежит таблице. Без слота рисуется над таблицей,
 * так что компонент остаётся самодостаточным.
 */
export function DataTable<T extends RowData>({
  data,
  columns,
  testid,
  rowId,
  markets,
  loading = false,
  notice = null,
  emptyText,
  toolbarExtra,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const slot = useContext(ToolbarSlotContext);

  const table = useTable({
    features,
    data,
    columns,
    getRowId: (row) => rowId(row),
    state: { sorting, columnVisibility, columnFilters },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
  });

  const marketFilter = table.getColumn(MARKET_COLUMN_ID);
  const market = (marketFilter?.getFilterValue() as string) ?? ALL_MARKETS;

  const toolbar = (
    <DataTableToolbar
      columns={table.getAllLeafColumns().map((c) => ({
        id: c.id,
        label:
          typeof c.columnDef.header === "string" ? c.columnDef.header : c.id,
        visible: c.getIsVisible(),
        canHide: c.getCanHide(),
        toggle: () => c.toggleVisibility(),
      }))}
      markets={markets}
      market={market}
      onMarketChange={(value) =>
        marketFilter?.setFilterValue(value === ALL_MARKETS ? undefined : value)
      }
      extra={toolbarExtra}
    />
  );

  const rows = table.getRowModel().rows;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {slot ? createPortal(toolbar, slot) : toolbar}
      {loading ? (
        <div
          className="py-6 text-center text-sm text-muted"
          data-testid={`${testid}-loading`}
        >
          Loading…
        </div>
      ) : notice ? (
        <div
          className="py-6 text-center text-sm text-muted"
          data-testid={notice.testid}
        >
          {notice.text}
        </div>
      ) : rows.length === 0 ? (
        <div
          className="py-6 text-center text-sm text-muted"
          data-testid={`${testid}-empty`}
        >
          {emptyText}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Table data-testid={testid}>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    return (
                      <TableHead
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        className={
                          header.column.getCanSort()
                            ? "cursor-pointer select-none hover:text-text"
                            : undefined
                        }
                        data-testid={`table-header-${header.column.id}`}
                      >
                        {header.isPlaceholder ? null : (
                          <span className="inline-flex items-center gap-1">
                            <table.FlexRender header={header} />
                            {sorted === "asc" ? (
                              <ChevronUp size={12} />
                            ) : sorted === "desc" ? (
                              <ChevronDown size={12} />
                            ) : null}
                          </span>
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} data-testid={`${testid}-row-${row.id}`}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
