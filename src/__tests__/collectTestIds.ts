import { globSync, readFileSync } from "node:fs";

const STATIC = /data-testid="([^"]+)"/g;
const TEMPLATE = /data-testid=\{`([^`]+)`\}/g;
// Идентификатор доезжает до DOM и пропом: `<DialogContent overlayTestId="…">`.
// Инвентарь считает идентификаторы, а не синтаксис их передачи, иначе перевод
// оверлея на проп читался бы как потеря контракта.
const PROP = /(?:overlayTestId|testid)="([^"]+)"/g;
// Тот же проп, но шаблонной строкой: `<BookRow testid={`book-ask-${i}`}>`.
// Без этой ветки `book-ask-*`/`book-bid-*` молча выпадали из инвентаря —
// PROP берёт только статический литерал, а BookRow передаёт testid дальше в
// data-testid={testid}, так что сам DOM-атрибут в исходнике не виден.
const PROP_TEMPLATE = /(?:overlayTestId|testid)=\{`([^`]+)`\}/g;

/**
 * Инвентарь `data-testid` исходников. Шаблонный идентификатор нормализуется
 * подстановкой `*` вместо интерполяции: `order-row-${o.id}` → `order-row-*`,
 * иначе снапшот менялся бы от переименования локальной переменной.
 */
export function collectTestIds(root = "src"): string[] {
  const files = globSync(`${root}/**/*.tsx`);
  const ids = new Set<string>();
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const [, id] of source.matchAll(STATIC)) ids.add(id);
    for (const [, tpl] of source.matchAll(TEMPLATE))
      ids.add(tpl.replace(/\$\{[^}]*\}/g, "*"));
    for (const [, id] of source.matchAll(PROP)) ids.add(id);
    for (const [, tpl] of source.matchAll(PROP_TEMPLATE))
      ids.add(tpl.replace(/\$\{[^}]*\}/g, "*"));
  }
  return [...ids].sort();
}
