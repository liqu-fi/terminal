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

  it("шрифт, названный первым в стеке, приложение и правда везёт", () => {
    // Первый шрифт стека, доставшийся приложению случайно (он оказался у
    // пользователя в системе), — не выбор, а совпадение. Импорта пакета для
    // этого мало: имя семейства в токене должно совпасть с тем, которое пакет
    // объявляет. `@fontsource-variable/inter` объявляет `Inter Variable`, и
    // стек, начинающийся с `Inter`, до самохостящегося шрифта не доходит —
    // именно этот разрыв тест и стережёт.
    const SYSTEM = ["system-ui", "-apple-system", "sans-serif", "serif", "monospace"];
    const first = tokens.match(/--font:\s*"?([^",;]+)"?/)![1].trim();
    if (SYSTEM.includes(first)) return; // стек намеренно системный — везти нечего

    const imported = theme.match(/@import\s+"(@fontsource[^"]*)"/)?.[1];
    expect(
      imported,
      `стек начинается с «${first}», но ни один пакет шрифта не импортирован`,
    ).toBeDefined();

    const declared = [
      ...readFileSync(`node_modules/${imported}/index.css`, "utf8").matchAll(
        /font-family:\s*'([^']+)'/g,
      ),
    ].map((m) => m[1]);
    expect(declared).toContain(first);
  });
});
