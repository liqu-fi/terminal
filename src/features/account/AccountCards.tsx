import type { PortfolioPeriod } from "@liq/api-client";
import type { ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { PERIOD_LABEL, PERIODS } from "./accountLogic";

/**
 * Карточка страницы Account. Со своей рамкой и скруглением — в отличие от
 * `Card` терминала: там панели стоят вплотную под одной общей рамкой, здесь
 * карточки разнесены сеткой и рамка у каждой.
 */
export function Panel({
  children,
  className = "",
  testid,
}: {
  children: ReactNode;
  className?: string;
  testid?: string;
}) {
  return (
    <section
      className={`rounded-[var(--radius-card)] border border-border bg-surface p-4 ${className}`}
      data-testid={testid}
    >
      {children}
    </section>
  );
}

/** Плитка «подпись / значение», справа — необязательная ссылка-стрелка. */
export function Stat({
  label,
  value,
  sub,
  tone = "text-text",
  link,
  testid,
}: {
  label: string;
  value: string;
  /** Подстрочник под значением («Margin usage 28.6%», «2 assets»). */
  sub?: string;
  tone?: string;
  link?: { href: string; text: string };
  testid: string;
}) {
  return (
    <Panel className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>{label}</span>
        {link && (
          <a href={link.href} className="shrink-0 text-accent hover:underline">
            {link.text} →
          </a>
        )}
      </div>
      <span
        className={`text-xl font-semibold tabular-nums ${tone}`}
        data-testid={testid}
      >
        {value}
      </span>
      {sub && (
        <span className="text-xs text-muted" data-testid={`${testid}-sub`}>
          {sub}
        </span>
      )}
    </Panel>
  );
}

/** Селектор периода портфеля; пункты — `${testid}-${period}`. */
export function PeriodSelect({
  value,
  onChange,
  testid,
}: {
  value: PortfolioPeriod;
  onChange: (period: PortfolioPeriod) => void;
  testid: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as PortfolioPeriod)}
    >
      <SelectTrigger size="sm" className="h-7 text-xs" data-testid={testid}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIODS.map((p) => (
          <SelectItem key={p} value={p} data-testid={`${testid}-${p}`}>
            {PERIOD_LABEL[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** `available: false` портфеля: сабграф молчит — кривой нет, а не ошибка. */
export function Unavailable() {
  return (
    <p
      className="flex h-full items-center justify-center text-center text-xs text-muted"
      data-testid="portfolio-unavailable"
    >
      Portfolio history is unavailable on this gateway
    </p>
  );
}
