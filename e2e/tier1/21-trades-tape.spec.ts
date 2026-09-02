import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";
import {
  armHold,
  limitOrderFixture,
  readyWorld,
  releaseHold,
  sseOrderUpdateFrame,
  sseTradeFrame,
  tradeFixture,
} from "../support/world";

test.describe("trades tape", () => {
  test("вкладка показывает сделки рынка", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world, () =>
      // 2024-06-01T13:45:07.000Z. Часы, минуты и секунды различны нарочно:
      // ради этого в `playwright.config.ts` и пришпилен `timezoneId: "UTC"`.
      // Юнит на `fmtTapeTime` проверяет только форму `\d\d:\d\d:\d\d`, и
      // перестановка часов с минутами, приём секунд вместо миллисекунд или
      // возврат константы прошли бы её насквозь — конкретное значение
      // сторожится здесь и только здесь.
      readyWorld({ trades: [tradeFixture({ timestamp: 1_717_249_507_000 })] }),
    );
    await book.selectTab("trades");
    await expect(book.tapeRows).toHaveCount(1);
    await expect(book.tapeRows.first()).toContainText("70,000");
    await expect(book.tapeRows.first()).toContainText("13:45:07");
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

  test("ссылка на транзакцию есть у REST-строки и нет у живой", async ({
    page,
    world,
  }) => {
    // Обе половины контраста в одном мире. На мире без REST-сделок «у живой
    // строки ссылки нет» не отличало бы себя от «ссылки нет ни у кого»: строка
    // САМА становится `<a>` (см. `TapeSlotRow`), поэтому проверять надо тег
    // строки, а не вложенный `a` — вложенного не бывает ни у той, ни у другой.
    const rest = tradeFixture();
    const { book } = await enterTerminal(page, world, () =>
      readyWorld({ trades: [rest] }),
    );
    await book.selectTab("trades");
    await expect(book.tapeRows).toHaveCount(1);

    const restRow = book.tapeRows.first();
    expect(await restRow.evaluate((el) => el.tagName)).toBe("A");
    await expect(restRow).toHaveAttribute("href", new RegExp(rest.txHash));

    // Живое событие несёт цену и время, но не `txHash` — ссылки быть не может.
    world.sseFrames = [
      sseTradeFrame("200", { price: "70500", size: "1", side: "BUY" }),
    ];
    await expect(book.tapeRows.first()).toContainText("70,500", {
      timeout: 15_000,
    });
    expect(await book.tapeRows.first().evaluate((el) => el.tagName)).toBe(
      "DIV",
    );
    // REST-строка уехала вниз и осталась ссылкой — контраст в одном кадре.
    expect(await book.tapeRows.nth(1).evaluate((el) => el.tagName)).toBe("A");
  });

  test("«сделок нет» говорится только после загрузки, а не вместо неё", async ({
    page,
    world,
  }) => {
    // Барьер держит ответ `/trades`, поэтому «загружаем» и «сделок нет» —
    // два разных наблюдаемых состояния, а не одно. Без ветки загрузки лента
    // печатала «No trades yet.» ещё до того, как страница приехала:
    // подставленное утверждение, которое читается как измеренное.
    const { book } = await enterTerminal(page, world);
    armHold(world, "tradesRead");
    await book.selectTab("trades");
    await expect(book.tapeLoading).toBeVisible();
    await expect(book.tapeEmpty).toHaveCount(0);

    releaseHold(world, "tradesRead");
    await expect(book.tapeEmpty).toBeVisible();
    await expect(book.tapeLoading).toHaveCount(0);
  });

  test("живой тик во время загрузки страницы уже видно", async ({
    page,
    world,
  }) => {
    // `isLoading` приходит прямо из `useTradesRestQuery` и живым тиком не
    // гасится, поэтому ранний выход по одному только `isLoading` прятал бы
    // сделку, уже приехавшую по подписке. У книги рядом такой беды нет — её
    // `isLoading` в SDK гаснет от первого живого кадра.
    const { book, userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ openOrders: [limitOrderFixture()] }),
    );
    await userInfo.selectTab("open-orders");
    await expect(userInfo.orderRow("ord-limit-1")).toBeVisible();

    armHold(world, "tradesRead");
    await book.selectTab("trades");
    await expect(book.tapeLoading).toBeVisible();
    await expect
      .poll(() =>
        world.sseConnections.some((c) => c.includes("trades:200")),
      )
      .toBe(true);

    world.sseFrames = [
      sseTradeFrame("200", { price: "70500", size: "1", side: "BUY" }),
      sseOrderUpdateFrame("ord-limit-1", "SETTLED"),
    ];
    await expect(userInfo.ordersEmpty).toBeVisible({ timeout: 15_000 });

    // Страница REST всё ещё в полёте — но показывать уже есть что.
    await expect(book.tapeRows).toHaveCount(1);
    await expect(book.tapeRows.first()).toContainText("70,500");
    await expect(book.tapeLoading).toHaveCount(0);

    releaseHold(world, "tradesRead");
    await expect(book.tapeRows).toHaveCount(1);
  });

  test("без рынка лента не показывает межрыночный поток", async ({
    page,
    world,
  }) => {
    // `/markets` лежит ⇒ рынка нет, и фильтр запроса теряет `marketId`:
    // гейтвей отвечает сделками по ВСЕМ рынкам (мок фильтры игнорирует, так
    // что здесь он ведёт себя как гейтвей без фильтра — ровно нужный
    // сценарий). Показывать эти строки нельзя, и «No trades yet.» тоже:
    // и то и другое — утверждение о рынке, которого на экране нет.
    const { book } = await enterTerminal(page, world, () =>
      readyWorld({ trades: [tradeFixture()], faults: { marketsStatus: 500 } }),
    );
    await book.selectTab("trades");
    await expect(book.tapeNoMarket).toBeVisible();
    await expect(book.tapeRows).toHaveCount(0);
    await expect(book.tapeEmpty).toHaveCount(0);
    await expect(book.tapeLoading).toHaveCount(0);
  });

  test("событие с нераспознанной стороной в ленту не попадает", async ({
    page,
    world,
  }) => {
    // `side` на проводе — голая строка. Раскрасить неизвестное значение в BUY
    // (прежнее `=== "SELL" ? "SELL" : "BUY"`) значило бы утверждать сторону
    // сделки, которой никто не сообщал; сделка придёт следующей страницей
    // REST уже типизированной. Барьер — тот же кадр чужого канала, что и в
    // тесте ниже: своего видимого следа у отброшенного события нет.
    const { book, userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ openOrders: [limitOrderFixture()] }),
    );
    await book.selectTab("trades");
    await expect(book.tapeEmpty).toBeVisible();
    await userInfo.selectTab("open-orders");
    await expect(userInfo.orderRow("ord-limit-1")).toBeVisible();

    world.sseFrames = [
      sseTradeFrame("200", { price: "70500", size: "1", side: "UNKNOWN" }),
      sseOrderUpdateFrame("ord-limit-1", "SETTLED"),
    ];
    await expect(userInfo.ordersEmpty).toBeVisible({ timeout: 15_000 });

    await expect(book.tapeRows).toHaveCount(0);
    await expect(book.tapeEmpty).toBeVisible();
  });

  // Не входит в исходную спеку задачи 6 — добавлено по её же таблице
  // мутационной проверки: снять фильтр по `timestamp` (пускать все живые
  // события) не завалит ни один из тестов выше, потому что там самая свежая
  // REST-строка либо отсутствует, либо старше живого события.
  //
  // Барьер синхронизации — кадр ЧУЖОГО канала, а не второй кадр ленты.
  // Устаревшее событие само по себе ничего не рисует, ждать его появления
  // нечем, а два кадра `trades:{id}` в одном ответе не наблюдаются оба:
  // клиент разбирает тело одним синхронным проходом (`pump` в `SseService`),
  // обе записи ложатся в один и тот же ключ кэша, и до рендера доживает
  // только последняя — проверено, лента показывала две строки вместо трёх
  // даже со снятым фильтром. Кадр `order:{id}` идёт в другой ключ, поэтому
  // наблюдаются оба; он же даёт видимое событие («ордер уехал из открытых»),
  // после которого устаревший тик заведомо уже прошёл через ленту — он
  // разобран раньше, первым в том же теле ответа.
  //
  // Точную границу `>` (а не `>=`) проверяет юнит `freshLiveRows` в
  // `useTradesTape.test.ts` — там же и основной мутационный тест для этой
  // строки таблицы.
  test("живое событие старше REST-строки в ленту не попадает", async ({
    page,
    world,
  }) => {
    const rest = tradeFixture({
      timestamp: Date.now(),
      price: "70000000000000000000000", // 70,000
    });
    const { book, userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ trades: [rest], openOrders: [limitOrderFixture()] }),
    );
    await book.selectTab("trades");
    await expect(book.tapeRows).toHaveCount(1);
    await userInfo.selectTab("open-orders");
    await expect(userInfo.orderRow("ord-limit-1")).toBeVisible();

    world.sseFrames = [
      sseTradeFrame("200", {
        price: "12345",
        size: "1",
        side: "SELL",
        timestamp: rest.timestamp - 60_000,
      }),
      sseOrderUpdateFrame("ord-limit-1", "SETTLED"),
    ];

    // Барьер: ордер ушёл из открытых ⇒ ответ доставлен и разобран целиком.
    await expect(userInfo.ordersEmpty).toBeVisible({ timeout: 15_000 });

    // Без фильтра устаревший тик лёг бы наверх ленты: две строки вместо одной.
    await expect(book.tapeRows).toHaveCount(1);
    await expect(book.root).not.toContainText("12,345");
  });
});
