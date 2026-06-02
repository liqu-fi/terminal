import { ConnectButton } from "./features/wallet/ConnectButton";

export default function App() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-surface-2 px-4 py-2">
        <span className="font-bold tracking-wide">◢ terminal</span>
        <div className="flex-1" />
        <ConnectButton />
      </header>
      <main className="flex-1 p-4 text-muted">Connect a wallet to begin.</main>
    </div>
  );
}
