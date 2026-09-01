import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * `@theme inline` ссылается на переменные из tokens.css. Рассинхронизация не
 * ломает сборку — Tailwind молча отдаёт пустое значение, и цвет пропадает
 * только на экране. Тест ловит это до экрана.
 */
describe("токены", () => {
  const tokens = readFileSync("src/styles/tokens.css", "utf8");
  const theme = readFileSync("src/styles/index.css", "utf8");

  it("каждая переменная, на которую ссылается @theme, определена", () => {
    const referenced = [...theme.matchAll(/var\((--[a-z0-9-]+)\)/g)].map(
      (m) => m[1],
    );
    expect(referenced.length).toBeGreaterThan(0);
    const missing = referenced.filter((name) => !tokens.includes(`${name}:`));
    expect(missing).toEqual([]);
  });

  it("несёт мягкие фоны сторон книги", () => {
    expect(tokens).toContain("--long-soft:");
    expect(tokens).toContain("--short-soft:");
  });

  it("шрифт, названный в стеке, приложение и правда везёт", () => {
    // Первый шрифт стека, доставшийся приложению случайно (он оказался у
    // пользователя в системе), — не выбор, а совпадение. Стек имеет право
    // называть Inter только пока index.css его импортирует.
    if (tokens.includes("Inter")) {
      expect(theme).toContain("@fontsource-variable/inter");
    }
  });
});
