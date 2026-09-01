import { bookTickOptions, Price } from "@liq/sdk";
import { useOrderbook } from "@liq/react";

import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useMarkPrice } from "../trade/useMarkPrice";
import { useSelectedMarket } from "../market/useSelectedMarket";

/** Сколько строк на сторону в режиме «обе стороны». */
const SLOTS_BOTH = 10;

export function OrderBookPanel() {
  const { marketId } = useSelectedMarket();
  const markPrice = useMarkPrice();
  const tick = bookTickOptions(markPrice === 0n ? null : Price(markPrice))[0];
  const { book, isLoading, unavailable, error } = useOrderbook(marketId ?? null, {
    tick,
    depth: SLOTS_BOTH,
    markPrice: markPrice === 0n ? undefined : Price(markPrice),
  });

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

        <TabsContent value="book" className="flex-1">
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
            <div data-testid="book-grid-placeholder" />
          )}
        </TabsContent>

        <TabsContent value="trades" className="flex-1">
          <div data-testid="trades-tape-placeholder" />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
