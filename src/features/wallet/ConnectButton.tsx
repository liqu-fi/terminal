import { useAccount, useConnect, useDisconnect } from "wagmi";

import { Button } from "../../components/ui/Button";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="rounded-[var(--radius-sm)] border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-text"
        title="Disconnect"
        data-testid="wallet-address-button"
      >
        {short(address)}
      </button>
    );
  }

  // Lightweight flavor: pick the first connector. `getConfig()` registers
  // exactly one — `injected()` — since WalletConnect is owned by Turnkey, not
  // by wagmi (see `config/chain.ts`), so this is the injected wallet.
  const connector = connectors[0];
  return (
    <Button
      disabled={isPending || !connector}
      onClick={() => connector && connect({ connector })}
      data-testid="connect-wallet-button"
    >
      {isPending ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}
