import { useSessionKey } from "@liq/react";
import { type ISessionSigner } from "@liq/sdk";
import { useState } from "react";

import { Button } from "../../components/ui/Button";

type Props = {
  manager: ISessionSigner;
  onClose: () => void;
};

/**
 * Modal for creating or revoking a session-key grant (1-click trading).
 *
 * @remarks
 * Plain fixed-overlay modal (no Radix Dialog in the terminal). Open state is
 * owned by SessionKeyButton; this component only renders the panel + actions.
 */
export function SessionKeyModal({ manager, onClose }: Props) {
  const { isActive, expiresAt, createSession, revokeSession } =
    useSessionKey(manager);
  const [pending, setPending] = useState(false);

  async function handleCreate(days: 1 | 7 | 30) {
    setPending(true);
    try {
      await createSession(days);
      onClose();
    } finally {
      setPending(false);
    }
  }

  async function handleRevoke() {
    setPending(true);
    try {
      await revokeSession();
      onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      data-testid="session-key-modal-overlay"
      onClick={onClose}
    >
      <div
        className="w-[360px] max-w-[calc(100vw-32px)] rounded-[var(--radius-card)] border border-border bg-surface p-4 text-text"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">
            {isActive ? "1-click trading active" : "Enable 1-click trading"}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-muted transition hover:bg-surface-2 hover:text-text"
            data-testid="session-key-modal-close"
          >
            ✕
          </button>
        </div>

        {isActive ? (
          <div className="flex flex-col gap-3">
            <p className="text-[12px] leading-relaxed text-muted">
              Session key active. Orders are submitted without wallet prompts
              until the session expires.
            </p>
            <p className="text-[12px] text-text">
              Expires:{" "}
              <span className="font-mono text-text">
                {expiresAt ? new Date(expiresAt).toLocaleString() : "—"}
              </span>
            </p>
            <Button
              variant="short"
              disabled={pending}
              onClick={handleRevoke}
              data-testid="session-key-revoke-button"
            >
              {pending ? "Revoking…" : "Revoke session"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[12px] leading-relaxed text-muted">
              Your wallet signs a one-time grant authorising a session key to
              submit orders for the selected duration. You can revoke at any
              time.
            </p>
            <div className="flex gap-2">
              {([1, 7, 30] as const).map((days) => (
                <Button
                  key={days}
                  variant="ghost"
                  className="flex-1"
                  disabled={pending}
                  onClick={() => handleCreate(days)}
                  data-testid={`session-key-create-${days}`}
                >
                  {pending ? "…" : `${days} day${days === 1 ? "" : "s"}`}
                </Button>
              ))}
            </div>
            <p className="text-[10px] leading-relaxed text-muted">
              The session key is held in Turnkey&apos;s secure enclave — it
              never touches this browser and can only submit orders, never
              withdraw funds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
