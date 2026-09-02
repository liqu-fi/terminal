import { cva } from "class-variance-authority";

// shadcn's словарь заменён нашим:
//   hover:bg-muted hover:text-muted-foreground → hover:bg-surface-2 hover:text-text
//     (та же пара, что в TabsTrigger: неактивный элемент светлеет на hover)
//   focus-visible:border-ring / ring-ring → focus-visible:border-accent / ring-accent
//     (border-ring и ring-ring — токены, которых в теме терминала нет; замена
//     дословно как в button.tsx)
//   aria-invalid:border-destructive / ring-destructive → …-short (нет brand
//     "destructive", у терминала это "short" — тот же цвет, что в button.tsx)
//   data-[state=on]:bg-accent/text-accent-foreground → bg-surface/text-text
//     ("accent" в shadcn — нейтральная подсветка, а не бренд-синий; выбранное
//     состояние сегмента здесь ведёт себя как активный таб — bg-surface, а не
//     заливка бренд-цветом)
//   dark:aria-invalid:ring-destructive/40 — убран: у терминала одна тёмная
//     тема через CSS-переменные, класса `.dark` в разметке не бывает
const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none hover:bg-surface-2 hover:text-text focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-short aria-invalid:ring-short/20 data-[state=on]:bg-surface data-[state=on]:text-text [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        // border-input → border-border, hover:bg-accent/text-accent-foreground
        // → hover:bg-surface-2/text-text — тот же контур-hover, что в
        // button.tsx outline (border border-border bg-transparent hover:bg-surface-2)
        outline:
          "border border-border bg-transparent shadow-xs hover:bg-surface-2 hover:text-text",
      },
      size: {
        default: "h-9 min-w-9 px-2",
        sm: "h-8 min-w-8 px-1.5",
        lg: "h-10 min-w-10 px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// Экспортируется только словарь классов: одиночного `Toggle` в разметке
// терминала нет, сегменты книги строит `ToggleGroupItem`, который берёт
// отсюда `toggleVariants`. Компонент-обёртка из шаблона shadcn удалён, чтобы
// мёртвый публичный экспорт не выглядел частью контракта модуля.
export { toggleVariants };
