import { useAccount, useConnect, useDisconnect } from "wagmi";

import { Button } from "@/components/ui/button";

import { useIdentityDoor } from "../auth/IdentityDoorProvider";
import { INJECTED_CONNECTOR_ID } from "../auth/identityDoor";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { setDoor, forgetDoor } = useIdentityDoor();

  if (isConnected && address) {
    return (
      <button
        onClick={() => {
          forgetDoor();
          disconnect();
        }}
        className="rounded-[var(--radius-sm)] border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-text"
        title="Disconnect"
        data-testid="wallet-address-button"
      >
        {short(address)}
      </button>
    );
  }

  // По id, а не по индексу: с появлением двери Turnkey в конфиге два
  // коннектора, и `connectors[0]` подключал бы то, что раньше стоит в списке.
  const connector = connectors.find((c) => c.id === INJECTED_CONNECTOR_ID);
  return (
    <Button
      disabled={isPending || !connector}
      onClick={() =>
        connector &&
        connect(
          { connector },
          // Дверь пишется по факту подключения, а не по клику: отменённый в
          // расширении коннект не должен оставлять после себя дверь, которую
          // следующая загрузка попробует восстановить.
          { onSuccess: () => setDoor("injected") },
        )
      }
      data-testid="connect-wallet-button"
    >
      {isPending ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}
