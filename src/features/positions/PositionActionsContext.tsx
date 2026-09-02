import { createContext, useContext } from "react";

import type { PositionRow } from "./usePositionRows";

/**
 * Действия таблицы позиций — контекстом, а не полем строки.
 *
 * @remarks Колонки объявлены на уровне модуля и до состояния компонента не
 * дотягиваются, а `Close All` живёт в шапке, где строки нет вовсе. Контекст —
 * единственное место, откуда и ячейка, и шапка видят одно и то же.
 */
export interface PositionActions {
  /** Все строки таблицы — их закрывает `Close All`, которому строку не дают. */
  rows: readonly PositionRow[];
  /** Спросить подтверждение на закрытие перечисленных позиций. */
  requestClose: (rows: readonly PositionRow[]) => void;
  /** Открыть правку скобок одной позиции. */
  requestEdit: (row: PositionRow) => void;
  /** Идёт ли проход закрытия — обе кнопки на это время выключены. */
  closing: boolean;
}

const NOOP: PositionActions = {
  rows: [],
  requestClose: () => {},
  requestEdit: () => {},
  closing: false,
};

export const PositionActionsContext = createContext<PositionActions>(NOOP);

export function usePositionActions(): PositionActions {
  return useContext(PositionActionsContext);
}
