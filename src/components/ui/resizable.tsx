import { GripVerticalIcon } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

function ResizablePanelGroup({
  className,
  ...props
}: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn(
        // `min-h-0`/`min-w-0` — не косметика: вложенная группа (горизонтальная
        // внутри вертикальной) сама является flex-элементом и без них растёт
        // под свой контент вместо отведённого ей размера.
        "flex h-full w-full min-h-0 min-w-0 aria-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Панель группы.
 *
 * @remarks Библиотека рисует ДВА div-а: внешний (`data-panel`, несёт flex-размер
 * и жёстко зашитый инлайном `overflow: visible`) и внутренний, которому достаются
 * наши `className` и `style`. Отсюда разделение обязанностей:
 *
 * - внешнему `min-height: 0` даёт правило `[data-panel]` в `index.css` — классом
 *   до него не дотянуться, а без него `min-height: auto` flex-элемента позволяет
 *   контенту распирать панель наружу, поверх соседей;
 * - внутреннему здесь ставится `overflow: hidden` СТИЛЕМ, а не классом: свой
 *   `overflow: auto` библиотека пишет инлайном, и класс его не перебьёт. Панель
 *   не прокручивается целиком — скроллом заведует та область внутри неё, которой
 *   он положен (форма ордера, тело таблицы).
 */
function ResizablePanel({
  className,
  style,
  ...props
}: ResizablePrimitive.PanelProps) {
  return (
    <ResizablePrimitive.Panel
      data-slot="resizable-panel"
      className={cn("flex min-h-0 min-w-0 flex-col", className)}
      style={{ overflow: "hidden", ...style }}
      {...props}
    />
  );
}

/**
 * Ручка ресайза: линия в 1px, зона захвата — 9px.
 *
 * @remarks Псевдоэлемент `after` расширяет площадь попадания, не двигая
 * раскладку: сама линия остаётся волосяной, но промахнуться по ней мышью уже
 * нельзя. Отключённая ручка (`disabled`) теряет и курсор, и подсветку — мёртвая
 * зона не должна выглядеть живой.
 */
function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "relative flex w-px cursor-col-resize items-center justify-center bg-border transition-colors",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-[9px] after:-translate-x-1/2",
        "hover:bg-accent/70 focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-hidden",
        "aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:cursor-row-resize",
        "aria-[orientation=horizontal]:after:top-1/2 aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-[9px] aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2",
        "data-[disabled]:cursor-default data-[disabled]:hover:bg-border",
        "[&[aria-orientation=horizontal]>div]:rotate-90",
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-xs border bg-border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
