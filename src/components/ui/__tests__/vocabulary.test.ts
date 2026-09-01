import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * shadcn генерирует компоненты под свой словарь токенов — `bg-primary`,
 * `text-foreground`, `ring-ring`, `border-input`. Терминал этого словаря не
 * заводит: у него собственный (`bg-accent`, `text-text`, `border-border`).
 * Утилита с неопределённым токеном сборку не ломает — Tailwind молча выдаёт
 * пустоту, и кнопка теряет фон только на экране. Ни страж инвентаря, ни
 * локаторы e2e цвета не проверяют, так что поймать это может только здесь.
 */
const FOREIGN = [
  "primary",
  "secondary",
  "destructive",
  "background",
  "foreground",
  "input",
  "popover",
  "card",
  "ring",
];

describe("примитивы shadcn", () => {
  const dir = "src/components/ui";

  it("говорят словарём терминала, а не своим", () => {
    const files = readdirSync(dir).filter((f) => f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(`${dir}/${file}`, "utf8");
      for (const name of FOREIGN) {
        const hit = new RegExp(
          `(?:bg|text|border|ring|fill|stroke|from|to|via)-${name}\\b`,
        ).exec(src);
        if (hit) offenders.push(`${file}: ${hit[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
