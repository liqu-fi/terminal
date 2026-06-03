import { Price, Qty } from "@liq/sdk";
import { useDebounce, useTradePreview } from "@liq/react";

import { fmtPctFromBps, fmtPrice, fmtUsd } from "../../lib/format";

export function TradePreviewRow({
  marketId,
  sizeDelta,
  markPrice,
}: {
  marketId: bigint | undefined;
  sizeDelta: bigint;
  markPrice: bigint;
}) {
  const debounced = useDebounce(sizeDelta, 300);
  const enabled =
    marketId !== undefined && debounced !== 0n && markPrice !== 0n;
  const { data: preview } = useTradePreview(
    marketId ?? 0n,
    Qty(debounced), // signed size delta — Qty brand over the raw bigint
    Price(markPrice),
  );

  if (!enabled || !preview) return null;
  return (
    <div
      className="rounded-[var(--radius-sm)] border border-border bg-surface-2 p-2 text-[11px] text-muted"
      data-testid="trade-preview"
    >
      <Row label="Est. fill" value={fmtPrice(preview.fillPrice)} />
      <Row label="Fee" value={fmtUsd(preview.fee)} />
      <Row label="Price impact" value={fmtPctFromBps(preview.priceImpact)} />
      <Row label="Notional" value={fmtUsd(preview.notional)} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="text-text">{value}</span>
    </div>
  );
}
