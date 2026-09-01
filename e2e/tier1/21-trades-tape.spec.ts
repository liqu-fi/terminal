import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";
import { readyWorld, sseTradeFrame, tradeFixture } from "../support/world";

test.describe("trades tape", () => {
  test("вкладка показывает сделки рынка", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world, () =>
      readyWorld({ trades: [tradeFixture()] }),
    );
    await book.selectTab("trades");
    await expect(book.tapeRows).toHaveCount(1);
    await expect(book.tapeRows.first()).toContainText("70,000");
  });

  test("живое событие встаёт наверх ленты", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world, () =>
      readyWorld({ trades: [tradeFixture()] }),
    );
    await book.selectTab("trades");
    world.sseFrames = [
      sseTradeFrame("200", { price: "70500", size: "1", side: "SELL" }),
    ];
    await expect(book.tapeRows.first()).toContainText("70,500", {
      timeout: 15_000,
    });
  });

  test("у живой строки нет ссылки на транзакцию", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world);
    await book.selectTab("trades");
    world.sseFrames = [
      sseTradeFrame("200", { price: "70500", size: "1", side: "BUY" }),
    ];
    await expect(book.tapeRows.first()).toBeVisible({ timeout: 15_000 });
    await expect(book.tapeRows.first().locator("a")).toHaveCount(0);
  });

  test("пустая лента говорит об этом словами", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world);
    await book.selectTab("trades");
    await expect(book.tapeEmpty).toBeVisible();
  });

  // Не входит в исходную спеку задачи 6 — добавлено по её же таблице
  // мутационной проверки: снять фильтр по `timestamp` (пускать все живые
  // события) не завалит ни один из четырёх тестов выше, потому что там самая
  // свежая REST-строка либо отсутствует, либо старше живого события. Здесь
  // REST-строка новее сфабрикованного «живого» тика — без фильтра устаревшее
  // событие тоже легло бы в ленту.
  //
  // Устаревший кадр и кадр-маркер уходят двумя раздельными доставками, а не
  // одним снимком: `useMarketChannel` кладёт каждое событие в один и тот же
  // ключ react-query (`qc.setQueryData`), и если оба кадра попадут в один
  // HTTP-ответ мока, `pump` в SDK разберёт их последовательно, но эффект
  // компонента снимет из кэша уже финальное значение — устаревшее событие
  // не получит свой собственный цикл рендера, и тест не отличит фильтр от
  // его отсутствия. `expect.poll` на опустошение `world.sseFrames` дожидается
  // именно ДОСТАВКИ устаревшего кадра (тело ответа мока ушло клиенту) перед
  // тем, как выставить второй — так второй кадр гарантированно летит новым
  // SSE-переподключением, и оба проходят через собственный цикл обработки.
  // Маркер после этого — не отдельная проверка, а способ дождаться, что
  // устаревший кадр уже прошёл через фильтр к моменту сверки счётчика: если
  // бы фильтр его пропускал, строк стало бы три, а не две.
  test("живое событие старше REST-строки в ленту не попадает", async ({
    page,
    world,
  }) => {
    const fresh = tradeFixture({
      timestamp: Date.now(),
      price: "70000000000000000000000", // 70,000
    });
    const { book } = await enterTerminal(page, world, () =>
      readyWorld({ trades: [fresh] }),
    );
    await book.selectTab("trades");
    await expect(book.tapeRows).toHaveCount(1);

    world.sseFrames = [
      sseTradeFrame("200", {
        price: "1",
        size: "1",
        side: "SELL",
        timestamp: fresh.timestamp - 60_000,
      }),
    ];
    await expect.poll(() => world.sseFrames.length).toBe(0);

    world.sseFrames = [
      sseTradeFrame("200", { price: "70600", size: "1", side: "BUY" }),
    ];
    await expect(book.tapeRows.first()).toContainText("70,600", {
      timeout: 15_000,
    });
    await expect(book.tapeRows).toHaveCount(2);
  });
});
