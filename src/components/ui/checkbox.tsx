"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

// shadcn-словарь заменён нашим — тот же перенос, что в button.tsx/toggle.tsx:
//   border-input → border-border, focus-visible:border-ring / ring-ring → …-accent
//   aria-invalid:border-destructive / ring-destructive → …-short
//   data-[state=checked]:border-primary/bg-primary/text-primary-foreground →
//     …-accent/-accent/text-white (тот же `primary` → `accent`, что в button.tsx
//     default-варианте: "Прежний `primary` был умолчанием и красился в `bg-accent`")
//   dark:bg-input/30, dark:aria-invalid:ring-destructive/40, dark:data-[state=checked]:bg-primary —
//     убраны: одна тёмная тема через CSS-переменные, класса `.dark` не бывает

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-border shadow-xs transition-shadow outline-none focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-short aria-invalid:ring-short/20 data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-white",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
