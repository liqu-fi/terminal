import { Price } from "@liq/sdk";
import { useOrderbook } from "@liq/react";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { useMarkPrice } from "../trade/useMarkPrice";
import { useSelectedMarket } from "../market/useSelectedMarket";
import { BookGrid } from "./BookGrid";
import { baseSymbolOf } from "./bookView";
import { TickSelect } from "./TickSelect";
import { TradesTape } from "./TradesTape";
import { useBookSlots } from "./useBookSlots";
import { useBookTick } from "./useBookTick";

type BookViewMode = "both" | "bids" | "asks";

export function OrderBookPanel() {
  const { marketId, market, marketsLoading } = useSelectedMarket();
  const markPrice = useMarkPrice();
  const [view, setView] = useState<BookViewMode>("both");
  const { tick, setTick, options } = useBookTick(markPrice);

  // Число строк на сторону считается от фактической высоты области сетки, а не
  // берётся константой с макета: в одностороннем режиме место, которое делили
  // две стороны, достаётся одной — отсюда делитель. Это же число уходит в
  // `depth` запроса: несовпадение оставило бы половину сетки пустой.
  const { ref: gridRef, slots } = useBookSlots(view === "both" ? 2 : 1);

  const { book, asOf, isLoading, unavailable, error } = useOrderbook(
    marketId ?? null,
    {
      tick: Price(tick),
      depth: slots,
      markPrice: markPrice === 0n ? undefined : Price(markPrice),
    },
  );

  const isEmpty = book.bids.length === 0 && book.asks.length === 0;
  /**
   * Показывать нечего: снимка не было ни из REST-затравки, ни из подписки.
   *
   * @remarks Именно это, а не `error`, решает судьбу сообщений об отказе.
   * Затравка живёт с `retry: false, staleTime: Infinity` и без
   * `refetchInterval` — её ошибка не гаснет никогда, так что движок,
   * поднявшийся после отказа, давал бы «Order book failed to load.» поверх
   * исправной живой книги до самой смены рынка. `unavailable` при этом
   * гаснет сам (у него в условии есть источник), а `error` — нет.
   */
  const nothingToShow = asOf === null;
  /**
   * Ждём данных: либо саму книгу, либо ещё список рынков.
   *
   * @remarks `useOrderbook` выключен, пока рынка нет, и его `isLoading` в этот
   * момент ложен — а `marketId` равен `undefined` всё время запроса
   * `/markets`. Без второго слагаемого панель на КАЖДОМ холодном входе
   * печатала «рынок не выбран» ровно в тот момент, когда рынок выбирается.
   */
  const isWaiting = isLoading || marketsLoading;

  return (
    <Card
      className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-2"
      data-testid="orderbook-panel"
    >
      <Tabs defaultValue="book" className="flex min-h-0 flex-1 flex-col gap-2">
        <TabsList className="shrink-0">
          <TabsTrigger value="book" data-testid="orderbook-tab-book">
            Order Book
          </TabsTrigger>
          <TabsTrigger value="trades" data-testid="orderbook-tab-trades">
            Trades
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="book"
          className="flex min-h-0 flex-1 flex-col gap-2"
        >
          <div className="flex shrink-0 items-center justify-between px-1">
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(next) => {
                // Radix отдаёт "" при повторном клике по уже выбранному
                // элементу — сброс до одного из трёх режимов недопустим,
                // прежний выбор остаётся.
                if (next) setView(next as BookViewMode);
              }}
            >
              <ToggleGroupItem value="both" data-testid="book-view-both">
                Both
              </ToggleGroupItem>
              <ToggleGroupItem value="bids" data-testid="book-view-bids">
                Bids
              </ToggleGroupItem>
              <ToggleGroupItem value="asks" data-testid="book-view-asks">
                Asks
              </ToggleGroupItem>
            </ToggleGroup>
            <TickSelect tick={tick} options={options} onSelect={setTick} />
          </div>

          {/* Область сетки существует при ЛЮБОМ состоянии — по её высоте
              считается `slots`. Меряя саму сетку, мы получали бы ноль на
              экране загрузки и лишний запрос с минимальной глубиной сразу
              после того, как книга приедет. */}
          <div className="min-h-0 flex-1" ref={gridRef}>
            {isWaiting ? (
              <p
                className="py-6 text-center text-sm text-muted"
                data-testid="book-loading"
              >
                Loading order book…
              </p>
            ) : nothingToShow && unavailable ? (
              <p
                className="py-6 text-center text-sm text-muted"
                data-testid="book-unavailable"
              >
                No matching engine is maintaining this book right now.
              </p>
            ) : nothingToShow && error ? (
              <p
                className="py-6 text-center text-sm text-short"
                data-testid="book-error"
              >
                Order book failed to load.
              </p>
            ) : marketId == null ? (
              <p
                className="py-6 text-center text-sm text-muted"
                data-testid="book-no-market"
              >
                No market selected — no book to show.
              </p>
            ) : isEmpty ? (
              <p
                className="py-6 text-center text-sm text-muted"
                data-testid="book-empty"
              >
                Book is empty — orders execute against the liquidity pool.
              </p>
            ) : (
              <BookGrid
                book={book}
                view={view}
                slots={slots}
                tick={tick}
                markPrice={markPrice}
                baseSymbol={baseSymbolOf(market?.symbol)}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="trades" className="min-h-0 flex-1">
          {/* Keyed on the market: a switch remounts the tape so its live
              buffer starts empty rather than briefly mixing in ticks that
              belonged to the previous market. */}
          <TradesTape
            key={marketId?.toString() ?? "none"}
            marketId={marketId}
            marketsLoading={marketsLoading}
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
