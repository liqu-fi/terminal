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
    // Дожидается, что REST-строка уже отрисована, прежде чем выставлять
    // живой кадр — иначе кадр рискует достаться SSE-соединению, ещё не
    // переподписанному на набор каналов вкладки Trades (открытие вкладки
    // меняет список каналов, значит и переподключается сам поток), и тест
    // мигает так же, как и `20-orderbook.spec.ts`'s «живой снимок» ждёт
    // затравку прежде, чем выставить событие.
    await expect(book.tapeRows).toHaveCount(1);
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
    // Тот же барьер синхронизации, что и выше, только на пустом состоянии:
    // ждём, что «No trades yet.» уже отрисован (а значит подписка на канал
    // вкладки Trades уже переустановлена), прежде чем выставлять живой кадр.
    await expect(book.tapeEmpty).toBeVisible();
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
  // событие легло бы наверх ленты и вытеснило REST-строку из `.first()`.
  //
  // Единственная доставка, не две: канал `trades:{marketId}` в моке —
  // однократный long-poll на HTTP-запрос (см. `mockGateway.ts`), а SDK
  // переподключается только по новой подписке, не по завершении ответа —
  // второй доставке в одном тесте неоткуда взять живое соединение без ещё
  // одного действия, меняющего набор каналов. Точную границу `>` (а не `>=`)
  // проверяет юнит `freshLiveRows` в `useTradesTape.test.ts` — там же и
  // основной мутационный тест для этой строки таблицы.
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
    // Без фильтра эта строка легла бы наверх и `.first()` показал бы "1",
    // а не "70,000" — сам счётчик строк не меняется в обоих случаях.
    await expect(book.tapeRows.first()).toContainText("70,000", {
      timeout: 15_000,
    });
    await expect(book.tapeRows).toHaveCount(1);
  });
});
