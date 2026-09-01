import { formatPrice, getChainConfig } from "@liq/sdk";
import { useNetworkId } from "@liq/react";

import { fmtBookSize, fmtTapeTime, padSlots } from "./bookView";
import { type TapeRow, useTradesTape } from "./useTradesTape";

/** Rows shown at once — same fixed-height discipline as the book grid. */
const TAPE_SLOTS = 15;

interface TradesTapeProps {
  marketId: bigint | undefined;
}

/**
 * Public trade tape: REST fills plus live ticks, newest first.
 *
 * @remarks A live row is missing two things the REST row has: `txHash` (so
 * it never becomes an explorer link) and a maker/taker role (not shown for
 * ANY row here — role only means something relative to one account's own
 * history, which is `HistoryTable`, not the public tape). See
 * `useTradesTape` for why.
 */
export function TradesTape({ marketId }: TradesTapeProps) {
  const { rows } = useTradesTape(marketId ?? null);
  const networkId = useNetworkId();
  const explorerUrl = getChainConfig(networkId).blockExplorer?.url;

  if (rows.length === 0) {
    return (
      <p
        className="py-6 text-center text-sm text-muted"
        data-testid="tape-empty"
      >
        No trades yet.
      </p>
    );
  }

  const slots = padSlots(rows, TAPE_SLOTS, "end");

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="grid grid-cols-3 px-1 py-1 text-[10px] text-muted">
        <span>Price (USD)</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>

      <div>
        {slots.map((slot, i) =>
          slot === null ? (
            <div
              key={i}
              className="h-[18px]"
              data-testid="tape-slot-empty"
              aria-hidden
            />
          ) : (
            <TapeSlotRow
              key={slot.key}
              row={slot}
              testid={`tape-row-${i}`}
              explorerUrl={explorerUrl}
            />
          ),
        )}
      </div>
    </div>
  );
}

interface TapeSlotRowProps {
  row: TapeRow;
  testid: string;
  explorerUrl: string | undefined;
}

/**
 * One tape row. Becomes a link to the block explorer only when both the
 * row has a `txHash` (a live tick never does) and the chain config actually
 * carries a `blockExplorer` (it's an optional field) — never a dead link.
 */
function TapeSlotRow({ row, testid, explorerUrl }: TapeSlotRowProps) {
  const priceClass = row.side === "BUY" ? "text-long" : "text-short";
  const className =
    "grid h-[18px] grid-cols-3 items-center px-1 text-left text-xs";
  const content = (
    <>
      <span className={priceClass}>{formatPrice(row.price, { sign: "" })}</span>
      <span className="text-right text-text">{fmtBookSize(row.size)}</span>
      <span className="text-right text-muted">
        {fmtTapeTime(row.timestamp)}
      </span>
    </>
  );

  if (row.txHash !== null && explorerUrl) {
    return (
      <a
        href={`${explorerUrl}/tx/${row.txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} hover:bg-surface-2/60`}
        data-testid={testid}
      >
        {content}
      </a>
    );
  }

  return (
    <div className={className} data-testid={testid}>
      {content}
    </div>
  );
}
