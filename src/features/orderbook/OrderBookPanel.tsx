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
import { useBookTick } from "./useBookTick";

type BookViewMode = "both" | "bids" | "asks";

/** Сколько строк на сторону в режиме «обе стороны». */
const SLOTS_BOTH = 10;
/**
 * Сколько строк на сторону в одностороннем режиме.
 *
 * @remarks Один список занимает место, которое в режиме «обе стороны» делят
 * два — вдвое больше строк на ту же высоту панели. Это же число уходит в
 * `depth` вызова `useOrderbook`: несовпадение оставило бы половину сетки
 * пустой (запрошено 10 строк, а показывать нужно 20).
 */
const SLOTS_ONE_SIDE = 20;

export function OrderBookPanel() {
  const { marketId, market } = useSelectedMarket();
  const markPrice = useMarkPrice();
  const [view, setView] = useState<BookViewMode>("both");
  const { tick, setTick, options } = useBookTick(markPrice);

  const slots = view === "both" ? SLOTS_BOTH : SLOTS_ONE_SIDE;

  const { book, isLoading, unavailable, error } = useOrderbook(
    marketId ?? null,
    {
      tick: Price(tick),
      depth: slots,
      markPrice: markPrice === 0n ? undefined : Price(markPrice),
    },
  );

  const isEmpty = book.bids.length === 0 && book.asks.length === 0;

  return (
    <Card
      className="flex h-full flex-col gap-2 p-2"
      data-testid="orderbook-panel"
    >
      <Tabs defaultValue="book" className="flex flex-1 flex-col gap-2">
        <TabsList>
          <TabsTrigger value="book" data-testid="orderbook-tab-book">
            Order Book
          </TabsTrigger>
          <TabsTrigger value="trades" data-testid="orderbook-tab-trades">
            Trades
          </TabsTrigger>
        </TabsList>

        <TabsContent value="book" className="flex flex-1 flex-col gap-2">
          <div className="flex items-center justify-between px-1">
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

          {isLoading ? (
            <p
              className="py-6 text-center text-sm text-muted"
              data-testid="book-loading"
            >
              Loading order book…
            </p>
          ) : unavailable ? (
            <p
              className="py-6 text-center text-sm text-muted"
              data-testid="book-unavailable"
            >
              No matching engine is maintaining this book right now.
            </p>
          ) : error ? (
            <p
              className="py-6 text-center text-sm text-short"
              data-testid="book-error"
            >
              Order book failed to load.
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
        </TabsContent>

        <TabsContent value="trades" className="flex-1">
          <div data-testid="trades-tape-placeholder" />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
