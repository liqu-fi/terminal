import { useSessionKey, useSessionKeyManager } from "@liq/react";
import { useEffect, useState } from "react";

import { env } from "../../config/env";
import { SessionKeyModal } from "./SessionKeyModal";

/**
 * Header pill showing session-key (1-click trading) status.
 *
 * @remarks
 * Renders null when the manager is null — i.e. the Turnkey flag is off or the
 * wallet is not connected — so it is invisible unless the feature is live. The
 * config MUST be passed explicitly: Vite's `import.meta.env` is invisible to
 * the SDK's default `process.env` resolver.
 */
export function SessionKeyButton() {
  const manager = useSessionKeyManager({ config: env.turnkey });
  const { isActive, expiresAt } = useSessionKey(manager);
  const [open, setOpen] = useState(false);

  // `now` lives in state (lazy-initialised, never `Date.now()` during render —
  // React 19 purity) and ticks so the countdown stays roughly live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!manager) return null;

  const label =
    isActive && expiresAt
      ? `1-click: ${formatDuration(expiresAt - now)}`
      : "Enable 1-click trading";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-surface-2 px-3 py-1 text-[12px] font-medium text-text transition hover:border-accent"
        data-testid="session-key-button"
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-long" : "bg-muted"}`}
        />
        {label}
      </button>
      {open ? (
        <SessionKeyModal manager={manager} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "expired";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}
