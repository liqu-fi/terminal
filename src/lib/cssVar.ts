/**
 * Значение CSS-токена (`--long`, `--border`…) строкой — для библиотек, которым
 * нужен готовый цвет. Палитра объявлена один раз в `styles/tokens.css`;
 * захардкоженный hex молча разъехался бы с ней при перекраске.
 */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
