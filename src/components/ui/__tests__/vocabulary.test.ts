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
      // Комментарии выбрасываем: правило должно быть можно объяснить прозой
      // рядом с кодом, назвав запрещённые имена, и не сломать этим само себя.
      const src = readFileSync(`${dir}/${file}`, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      for (const name of FOREIGN) {
        const hit = new RegExp(
          `(?:bg|text|border|ring|fill|stroke|from|to|via)-${name}\\b`,
        ).exec(src);
        if (hit) offenders.push(`${file}: ${hit[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("опираются на базовый цвет границы, и он задан", () => {
    // shadcn пишет голый `border`, ожидая базового слоя, который красит границы
    // по умолчанию. В Tailwind v4 без такого слоя голый `border` — это
    // `currentColor`, то есть почти белая линия цвета текста вместо #20272d.
    // Сборка при этом целая, и увидеть это можно только глазами.
    const emitsBareBorder = readdirSync(dir)
      .filter((f) => f.endsWith(".tsx"))
      .some((f) =>
        /"[^"]*\bborder\b(?![-\w])/.test(readFileSync(`${dir}/${f}`, "utf8")),
      );
    if (!emitsBareBorder) return;

    const theme = readFileSync("src/styles/index.css", "utf8");
    expect(theme).toMatch(/@layer\s+base[\s\S]*border-color/);
  });
});
