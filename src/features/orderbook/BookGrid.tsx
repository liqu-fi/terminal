import { OrderType, Price, formatRatio, type BookSnapshot } from "@liq/sdk";
import { useTradeStore } from "@liq/react";

import { fmtPrice } from "@/lib/format";

import { BookRow } from "./BookRow";
import { askSlots, bidSlots, fmtBookPrice, ratioPct } from "./bookView";

interface BookGridProps {
  book: BookSnapshot;
  view: "both" | "bids" | "asks";
  slots: number;
  tick: bigint;
  markPrice: bigint;
  baseSymbol: string;
}

/**
 * Сетка книги: заголовок колонок, аски, строка спреда, биды, полоса
 * дисбаланса.
 *
 * @remarks Заголовок цены — `USD`, а не `USDT` с макета: контур торгует
 * sUSD, тикера котируемой валюты в конфигурации SDK нет, а перенесённый с
 * картинки `USDT` был бы утверждением о валюте, которого никто не проверял.
 */
export function BookGrid({
  book,
  view,
  slots,
  tick,
  markPrice,
  baseSymbol,
}: BookGridProps) {
  const setOrderType = useTradeStore((s) => s.setOrderType);
  const setLimitPrice = useTradeStore((s) => s.setLimitPrice);

  // Порядок обязателен и проверен по `dist` SDK: `setOrderType` пишет
  // `limitPrice: type === MARKET ? null : undefined`, то есть при LIMIT
  // затирает цену в `undefined`. Сначала тип, потом цена.
  const pick = (price: bigint) => {
    setOrderType(OrderType.LIMIT);
    setLimitPrice(Price(price));
  };

  const showAsks = view !== "bids";
  const showBids = view !== "asks";
  const asks = showAsks ? askSlots(book.asks, slots) : [];
  const bids = showBids ? bidSlots(book.bids, slots) : [];
  // Полоса дисбаланса всегда читает `book.bidShare` — долю по ВСЕЙ полученной
  // книге, а не по показанному срезу (см. TSDoc BookSnapshot.bidShare).
  const bidPct = ratioPct(book.bidShare);

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="grid grid-cols-3 px-1 py-1 text-[10px] text-muted">
        <span>Price (USD)</span>
        <span className="text-right">Size ({baseSymbol})</span>
        <span className="text-right">Total ({baseSymbol})</span>
      </div>

      {showAsks && (
        <div>
          {asks.map((slot, i) => (
            <BookRow
              key={i}
              slot={slot}
              side="ask"
              tick={tick}
              maxTotal={book.maxTotal}
              testid={`book-ask-${i}`}
              onPick={pick}
            />
          ))}
        </div>
      )}

      <div
        className="flex items-center justify-between px-1 py-1 text-xs"
        data-testid="book-spread"
      >
        <span className="text-sm text-text">
          {markPrice > 0n ? fmtPrice(markPrice) : "—"}
        </span>
        <span className="text-muted">
          {book.spread === null || book.spreadRatio === null
            ? "Spread —"
            : `Spread ${fmtBookPrice(book.spread, tick)} (${formatRatio(book.spreadRatio, { maxDecimals: 3 })})`}
        </span>
      </div>

      {showBids && (
        <div>
          {bids.map((slot, i) => (
            <BookRow
              key={i}
              slot={slot}
              side="bid"
              tick={tick}
              maxTotal={book.maxTotal}
              testid={`book-bid-${i}`}
              onPick={pick}
            />
          ))}
        </div>
      )}

      <div
        className="mt-1 flex h-4 items-center gap-1 text-[10px]"
        data-testid="book-imbalance"
        title="Share of resting size on each side of the whole received book"
      >
        <span className="text-long" data-testid="book-imbalance-bid">
          {bidPct}%
        </span>
        <div className="flex h-1.5 flex-1 overflow-hidden rounded-full">
          <div className="bg-[var(--long)]" style={{ width: `${bidPct}%` }} />
          <div className="flex-1 bg-[var(--short)]" />
        </div>
        <span className="text-short" data-testid="book-imbalance-ask">
          {100 - bidPct}%
        </span>
      </div>
    </div>
  );
}
