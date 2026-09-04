/**
 * Раскладка не имеет права накладываться сама на себя.
 *
 * @remarks `ResizablePanel` — flex-элемент, а у flex-элемента `min-height:
 * auto`: панель, чей контент выше выделенного ей размера, НЕ сжимается и НЕ
 * обрезается — она распухает и рисуется поверх соседей. Замер до починки на
 * 1280×800: карточка чарта вылезала на 425px ниже своей строки, стакан — на
 * 207px, а форма ордера (475px в колонке высотой 318px) уходила под карточку
 * счёта и под нижнюю панель. Глазами это читается как «блоки наезжают», а ни
 * один тест раскладки этого не видел: `19-layout.spec.ts` проверяет ширины и
 * высоты самих панелей, но не то, что контент внутри них помещается.
 *
 * Отсюда два инварианта, снятые с живого DOM, а не с классов: боксы соседних
 * панелей не пересекаются, и контент каждой панели помещается в неё.
 */
import { type Page } from "@playwright/test";

import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";
import {
  conditionalOrderFixture,
  limitOrderFixture,
  longPositionFixture,
  readyWorld,
} from "../support/world";

interface Box {
  testid: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
  scrollH: number;
  clientH: number;
}

/**
 * Панели верхнего ряда и нижняя — соседи, которые и налезали друг на друга.
 *
 * @remarks Именно контейнеры панелей, а не их содержимое: `getBoundingClientRect`
 * НЕ обрезается прокруткой предка, поэтому форма ордера внутри своей скролл-области
 * рапортует полную высоту и читалась бы как наложение там, где её просто не видно.
 * За то, что содержимое сидит внутри, отвечает второй тест.
 */
const PANELS = [
  "chart-panel",
  "orderbook-panel",
  "trade-column",
  "bottom-panel",
] as const;

/**
 * Экраны, на которых терминал обязан быть рабочим. 1280×800 — нижняя граница
 * (типичный ноутбук): именно на ней наложения были самыми грубыми.
 */
const VIEWPORTS = [
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1440x900", width: 1440, height: 900 },
];

/** Сценарий с непустыми таблицами: пустая нижняя панель ничего не доказывает. */
const busyWorld = () =>
  readyWorld({
    accounts: [
      {
        id: 1n,
        orderMode: "BOOK",
        available: 5_000n * 10n ** 18n,
        withdrawable: 5_000n * 10n ** 18n,
        positions: [longPositionFixture()],
      },
    ],
    openOrders: [limitOrderFixture()],
    conditionalOrders: [conditionalOrderFixture()],
  });

async function boxesOf(page: Page, testids: readonly string[]): Promise<Box[]> {
  return page.evaluate((ids: string[]) => {
    const out: Box[] = [];
    for (const testid of ids) {
      const el = document.querySelector<HTMLElement>(
        `[data-testid="${testid}"]`,
      );
      if (!el) continue;
      const r = el.getBoundingClientRect();
      out.push({
        testid,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        left: Math.round(r.left),
        right: Math.round(r.right),
        scrollH: el.scrollHeight,
        clientH: el.clientHeight,
      });
    }
    return out;
  }, [...testids]);
}

/**
 * Пересечение боксов с допуском в 1px: соседние панели делят пиксельную
 * границу ручки ресайза, и округление `getBoundingClientRect` даёт
 * «пересечение» в один пиксель там, где визуально его нет.
 */
function overlap(a: Box, b: Box): boolean {
  const h = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const v = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return h > 1 && v > 1;
}

for (const vp of VIEWPORTS) {
  test.describe(`сдерживание раскладки ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("панели не наезжают друг на друга", async ({ page, world }) => {
      await enterTerminal(page, world, busyWorld);
      await expect(page.getByTestId("chart-panel")).toBeVisible();
      await expect(page.getByTestId("orderbook-panel")).toBeVisible();

      const boxes = await boxesOf(page, PANELS);
      expect(
        boxes.map((b) => b.testid),
        "все панели верхнего ряда и нижняя должны быть в DOM",
      ).toEqual([...PANELS]);

      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          expect(
            overlap(a, b),
            `${a.testid} ${JSON.stringify(a)} накладывается на ${b.testid} ${JSON.stringify(b)}`,
          ).toBe(false);
        }
      }

      // Ни одна панель не выходит за терминал: вылет наружу — это и есть
      // «наехало на то, что нарисовано ниже».
      const [root] = await boxesOf(page, ["terminal-root"]);
      for (const box of boxes) {
        expect(
          box.bottom,
          `${box.testid} вылезает ниже терминала (${box.bottom} > ${root.bottom})`,
        ).toBeLessThanOrEqual(root.bottom + 1);
        expect(
          box.right,
          `${box.testid} вылезает правее терминала`,
        ).toBeLessThanOrEqual(root.right + 1);
      }
    });

    test("контент помещается в свою панель", async ({ page, world }) => {
      await enterTerminal(page, world, busyWorld);
      await expect(page.getByTestId("orderbook-panel")).toBeVisible();

      // Стакан и карточка чарта скролла не имеют по замыслу: книга считает
      // число слотов от своей высоты, чарт тянется за контейнером. Контент
      // выше клиентской области здесь — это тот самый вылет наружу.
      for (const testid of ["chart-panel", "orderbook-panel"]) {
        const [box] = await boxesOf(page, [testid]);
        expect(
          box.scrollH,
          `${testid}: контент ${box.scrollH}px не помещается в ${box.clientH}px`,
        ).toBeLessThanOrEqual(box.clientH + 1);
      }

      // Карточка счёта — подвал колонки тикета: она обязана лежать ВНУТРИ неё,
      // а не поверх формы, как было до `shrink-0` на ней и скролла у формы.
      const [column, account] = await boxesOf(page, [
        "trade-column",
        "account-panel",
      ]);
      expect(account.top).toBeGreaterThanOrEqual(column.top - 1);
      expect(account.bottom).toBeLessThanOrEqual(column.bottom + 1);

      // Терминал целиком помещается в окно: на поддерживаемых экранах
      // раскладка ужимается сама, а не отдаёт страницу вертикальному скроллу.
      const doc = await page.evaluate(() => ({
        scrollH: document.documentElement.scrollHeight,
        clientH: document.documentElement.clientHeight,
      }));
      expect(doc.scrollH).toBeLessThanOrEqual(doc.clientH + 1);
    });
  });
}
