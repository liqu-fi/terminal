# Phase 1: Fork Skeleton + Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip TBT paper-terminal of Binance/paper-trading logic and wire in `@liqu-fi/*` SDK with wallet-based auth so the app opens, connects a wallet, and authenticates against our exchange gateway.

**Architecture:** Replace TBT's fake auth (username/password), Binance WS worker, and paper-trading engine with `@liqu-fi/react` + `wagmi` + `connectkit`. The auth flow becomes: Connect Wallet → SIWE sign → Gateway JWT → account registered. Existing layout, routing, and UI chrome remain intact.

**Tech Stack:** React 18, Vite, TypeScript, wagmi v2, viem v2, @tanstack/react-query v5, connectkit v2, @liqu-fi/react, @liqu-fi/api-client, @liqu-fi/onchain, @liqu-fi/core

**Spec:** `monorepo/docs/superpowers/specs/2026-04-02-tbt-terminal-integration-design.md`

**Working directory:** `/Users/alex/Work/perps/tbt-paper-terminal`

---

## File Structure

### Delete
- `src/worker/marketDataWorker.ts` — Binance WS worker
- `src/worker/orderbook.ts` — Binance orderbook delta-merge logic
- `src/worker/orderbook.test.ts` — tests for above
- `src/store/tradingStore.ts` — paper-trading matching engine (800+ lines)
- `src/store/walletStore.ts` — fake wallet/balances
- `src/store/automationStore.ts` — automation triggers
- `src/store/authStore.ts` — username/password auth
- `src/services/marketDataService.ts` — Binance REST API
- `src/types/automation.ts` — automation types
- `src/types/wallet.ts` — fake wallet types
- `src/components/AutomationPanel/` — entire directory
- `src/pages/AuthPage.tsx` — username/password auth page
- `src/pages/AuthPage.module.css`

### Create
- `src/config/wagmi.ts` — wagmi config (chain, transports, connectors)
- `src/config/liq.ts` — LiqClient + LiqOnchain instantiation
- `src/config/env.ts` — env var access (VITE_GATEWAY_URL, VITE_CHAIN_ID, etc.)
- `src/providers/AppProviders.tsx` — WagmiProvider + QueryClientProvider + LiqProvider + ConnectKitProvider
- `src/store/authStore.ts` — new: wallet-based auth store (thin wrapper around useGatewayStore)
- `src/pages/AuthPage.tsx` — new: wallet connect page using ConnectKit

### Modify
- `package.json` — add @liqu-fi/*, wagmi, viem, connectkit, @tanstack/react-query
- `src/main.tsx` — wrap with AppProviders
- `src/App.tsx` — use wallet auth instead of username auth
- `src/components/Layout/DesktopLayout.tsx` — wallet connect button instead of AccountMenu
- `src/components/Layout/AccountMenu.tsx` — show connected wallet address
- `src/types/index.ts` — remove automation export
- `src/store/marketStore.ts` — stub worker subscription (no-op for now, Phase 2 replaces)
- `vite.config.ts` — remove Binance proxy, add env handling
- `tsconfig.json` — adjust if needed for @liqu-fi packages

---

### Task 1: Add dependencies and configure env

**Files:**
- Modify: `package.json`
- Create: `src/config/env.ts`
- Create: `.env.example`
- Modify: `vite.config.ts`

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/alex/Work/perps/tbt-paper-terminal
npm install @liqu-fi/core @liqu-fi/api-client @liqu-fi/onchain @liqu-fi/react \
  wagmi viem @tanstack/react-query connectkit
```

- [ ] **Step 2: Create env config**

Create `src/config/env.ts`:

```typescript
export const env = {
  gatewayUrl: import.meta.env.VITE_GATEWAY_URL as string || 'http://localhost:4000',
  chainId: Number(import.meta.env.VITE_CHAIN_ID) || 6343,
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string || '',
} as const;
```

- [ ] **Step 3: Create .env.example**

Create `.env.example`:

```
VITE_GATEWAY_URL=http://localhost:4000
VITE_CHAIN_ID=6343
VITE_WALLETCONNECT_PROJECT_ID=
```

- [ ] **Step 4: Update vite.config.ts — remove Binance proxy**

Replace `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/config/env.ts .env.example vite.config.ts
git commit -m "feat: add @liqu-fi SDK, wagmi, connectkit dependencies and env config"
```

---

### Task 2: Create wagmi + LiqClient config

**Files:**
- Create: `src/config/wagmi.ts`
- Create: `src/config/liq.ts`

- [ ] **Step 1: Create wagmi config**

Create `src/config/wagmi.ts`:

```typescript
import { createConfig, http } from 'wagmi';
import { type Chain } from 'viem';
import { env } from './env';

const megaethTestnet: Chain = {
  id: env.chainId,
  name: 'MegaETH Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://carrot.megaeth.com/rpc'] },
  },
};

export const wagmiConfig = createConfig({
  chains: [megaethTestnet],
  transports: {
    [megaethTestnet.id]: http(),
  },
});
```

- [ ] **Step 2: Create LiqClient config**

Create `src/config/liq.ts`:

```typescript
import { LiqClient } from '@liqu-fi/api-client';
import { LiqOnchain } from '@liqu-fi/onchain';
import { env } from './env';

export const liqClient = new LiqClient({
  baseUrl: env.gatewayUrl,
  chainId: env.chainId,
});

export const liqOnchain = new LiqOnchain({
  chainId: env.chainId,
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Note: This may show errors from other files we haven't modified yet — that's expected. The config files themselves should have no errors.

- [ ] **Step 4: Commit**

```bash
git add src/config/wagmi.ts src/config/liq.ts
git commit -m "feat: add wagmi chain config and LiqClient setup"
```

---

### Task 3: Create AppProviders

**Files:**
- Create: `src/providers/AppProviders.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create AppProviders**

Create `src/providers/AppProviders.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { ConnectKitProvider } from 'connectkit';
import { LiqProvider } from '@liqu-fi/react';
import type { ReactNode } from 'react';

import { wagmiConfig } from '../config/wagmi';
import { liqClient, liqOnchain } from '../config/liq';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider theme="midnight">
          <LiqProvider client={liqClient} onchain={liqOnchain}>
            {children}
          </LiqProvider>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

- [ ] **Step 2: Update main.tsx**

Replace `src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AppProviders } from './providers/AppProviders';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/global.css';

const initialTheme = localStorage.getItem('theme') ?? 'dark';
document.documentElement.setAttribute('data-theme', initialTheme);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>
);
```

- [ ] **Step 3: Commit**

```bash
git add src/providers/AppProviders.tsx src/main.tsx
git commit -m "feat: wrap app in WagmiProvider + LiqProvider + ConnectKit"
```

---

### Task 4: Delete paper-trading infrastructure

**Files:**
- Delete: `src/worker/marketDataWorker.ts`
- Delete: `src/worker/orderbook.ts`
- Delete: `src/worker/orderbook.test.ts`
- Delete: `src/store/tradingStore.ts`
- Delete: `src/store/walletStore.ts`
- Delete: `src/store/automationStore.ts`
- Delete: `src/store/authStore.ts`
- Delete: `src/store/watchlistStore.test.ts`
- Delete: `src/services/marketDataService.ts`
- Delete: `src/types/automation.ts`
- Delete: `src/types/wallet.ts`
- Delete: `src/pages/AuthPage.tsx`
- Delete: `src/pages/AuthPage.module.css`
- Delete: `src/components/AutomationPanel/` (entire directory)
- Modify: `src/types/index.ts`

- [ ] **Step 1: Delete files**

```bash
cd /Users/alex/Work/perps/tbt-paper-terminal
rm -rf src/worker/marketDataWorker.ts src/worker/orderbook.ts src/worker/orderbook.test.ts
rm src/store/tradingStore.ts src/store/walletStore.ts src/store/automationStore.ts src/store/authStore.ts
rm src/store/watchlistStore.test.ts
rm src/services/marketDataService.ts
rm src/types/automation.ts src/types/wallet.ts
rm src/pages/AuthPage.tsx src/pages/AuthPage.module.css
rm -rf src/components/AutomationPanel
```

- [ ] **Step 2: Update types/index.ts — remove automation export**

Replace `src/types/index.ts`:

```typescript
export * from './market';
export * from './trading';
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove Binance worker, paper-trading engine, fake auth/wallet"
```

---

### Task 5: Create new wallet-based auth store

**Files:**
- Create: `src/store/authStore.ts`

- [ ] **Step 1: Create new authStore**

This store wraps the `@liqu-fi/react` gateway store and exposes `isAuthenticated` which the existing layout/routing checks.

Create `src/store/authStore.ts`:

```typescript
import { create } from 'zustand';
import {
  useGatewayStore,
  selectIsAuthenticated as selectGatewayAuth,
} from '@liqu-fi/react';

/**
 * Auth store — bridges wallet-based auth (useGatewayStore from @liqu-fi/react)
 * to the app's existing isAuthenticated checks.
 *
 * Existing components use `useAuthStore(s => s.isAuthenticated)` — this store
 * derives that from the gateway JWT token state.
 */

interface AuthState {
  isAuthenticated: boolean;
}

export const useAuthStore = create<AuthState>()(() => ({
  isAuthenticated: false,
}));

// Sync gateway auth state → local authStore
useGatewayStore.subscribe(
  (state) => selectGatewayAuth(state),
  (isAuth) => {
    useAuthStore.setState({ isAuthenticated: isAuth });
  },
  { fireImmediately: true },
);

export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
```

- [ ] **Step 2: Commit**

```bash
git add src/store/authStore.ts
git commit -m "feat: new authStore bridging wallet auth to app isAuthenticated"
```

---

### Task 6: Create wallet connect auth page

**Files:**
- Create: `src/pages/AuthPage.tsx`
- Create: `src/pages/AuthPage.module.css`

- [ ] **Step 1: Create AuthPage with ConnectKit**

Create `src/pages/AuthPage.tsx`:

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConnectKitButton } from 'connectkit';
import { useAccount } from 'wagmi';
import { useGatewayAuthMutation } from '@liqu-fi/react';
import { useAuthStore } from '../store/authStore';
import { Icon } from '../components/Icon';
import styles from './AuthPage.module.css';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { address, isConnected } = useAccount();
  const gatewayAuth = useGatewayAuthMutation();

  // Redirect when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/trade');
    }
  }, [isAuthenticated, navigate]);

  // Auto-start gateway auth when wallet connects
  useEffect(() => {
    if (isConnected && address && !isAuthenticated && !gatewayAuth.isPending) {
      // Gateway auth will be triggered manually by user after connecting
    }
  }, [isConnected, address, isAuthenticated, gatewayAuth.isPending]);

  const handleAuth = () => {
    if (!isConnected) return;
    // accountId will be selected after auth — for now use a placeholder
    // The full account selector comes in Phase 3
    gatewayAuth.mutate({ accountId: 0n, alreadyBookMode: true });
  };

  return (
    <div className={styles.container}>
      <div className={styles.decor}>
        <div className={styles.grid} />
      </div>
      <div className={styles.overlay} />

      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <Icon name="activity" size="xl" strokeWidth={3} />
          </div>
          <span className={styles.title}>LIQ TERMINAL</span>
          <p className={styles.subtitle}>Decentralized Perpetuals Exchange</p>
        </div>

        <div className={styles.connectSection}>
          {!isConnected ? (
            <>
              <p className={styles.connectText}>
                Connect your wallet to start trading
              </p>
              <ConnectKitButton.Custom>
                {({ show }) => (
                  <button className={styles.connectBtn} onClick={show}>
                    <Icon name="wallet" size="sm" />
                    Connect Wallet
                  </button>
                )}
              </ConnectKitButton.Custom>
            </>
          ) : !isAuthenticated ? (
            <>
              <p className={styles.connectText}>
                Wallet connected: {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
              <button
                className={styles.connectBtn}
                onClick={handleAuth}
                disabled={gatewayAuth.isPending}
              >
                {gatewayAuth.isPending ? (
                  <Icon name="loader" className={styles.spinner} />
                ) : (
                  <>
                    <Icon name="shield-check" size="sm" />
                    Sign In to Exchange
                  </>
                )}
              </button>
              {gatewayAuth.isError && (
                <p className={styles.error}>
                  {gatewayAuth.error.message}
                </p>
              )}
            </>
          ) : null}
        </div>

        <div className={styles.footer}>
          <div className={styles.statusGrid}>
            <div className={styles.statusItem}>
              <span className={`${styles.dot} ${isConnected ? styles.ok : styles.pending}`} />
              <span>Wallet</span>
            </div>
            <div className={styles.statusItem}>
              <span className={`${styles.dot} ${isAuthenticated ? styles.ok : styles.pending}`} />
              <span>Gateway</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Create AuthPage CSS**

Copy the existing `src/pages/AuthPage.module.css` content from git history, then modify minimally. The key classes needed are: `container`, `decor`, `grid`, `overlay`, `card`, `header`, `logo`, `title`, `subtitle`, `connectSection`, `connectText`, `connectBtn`, `spinner`, `error`, `footer`, `statusGrid`, `statusItem`, `dot`, `ok`, `pending`.

Since we deleted the old CSS, create a minimal version. Use the old file as base (retrieve via `git show HEAD~1:src/pages/AuthPage.module.css`) and adapt — remove form-specific styles, keep layout and visual styles. Add `.connectSection`, `.connectText`, `.connectBtn`, `.error` styles.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AuthPage.tsx src/pages/AuthPage.module.css
git commit -m "feat: wallet connect auth page with ConnectKit + gateway auth"
```

---

### Task 7: Update App.tsx routing for wallet auth

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update App.tsx**

Replace `src/App.tsx`:

```tsx
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AdaptiveLayout } from './components/Layout';
import { ToastContainer } from './components/Toast';
import { TradePage } from './pages/TradePage';
import { MarketsPage } from './pages/MarketsPage';
import { OrdersPage } from './pages/OrdersPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';
import { useAuthStore } from './store/authStore';

function AuthPageWrapper() {
  return (
    <div className="app-container">
      <AuthPage />
      <ToastContainer />
    </div>
  );
}

export function App() {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();

  if (location.pathname === '/auth') {
    return <AuthPageWrapper />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <Routes>
      <Route element={<AdaptiveLayout />}>
        <Route path="/trade" element={<TradePage />} />
        <Route path="/markets" element={<MarketsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/" element={<Navigate to="/trade" replace />} />
        <Route path="*" element={<Navigate to="/trade" replace />} />
      </Route>
    </Routes>
  );
}
```

Removed: WalletPage, AssetDetailPage routes (fake wallet pages), PrivateRoute wrapper (redundant — top-level redirect handles it).

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: simplify routing — wallet auth, remove fake wallet pages"
```

---

### Task 8: Stub out deleted store references so app compiles

Many components still import from deleted stores (`tradingStore`, `walletStore`, `marketStore` worker). We need to create minimal stubs or fix imports so the app compiles. This is a large task — touching every component that imported the deleted modules.

**Files:**
- Modify: multiple components that import deleted stores
- Modify: `src/store/marketStore.ts` — remove Worker, use no-op subscribe

- [ ] **Step 1: Create stub tradingStore**

Create `src/store/tradingStore.ts` as a minimal stub:

```typescript
import { create } from 'zustand';

/**
 * Stub trading store — replaced in Phase 3 with @liqu-fi/react hooks.
 * Provides the interface that existing UI components expect.
 */
interface TradingState {
  orders: never[];
  positions: Map<string, never>;
  focusMode: boolean;
  setFocusMode: (enabled: boolean) => void;
  updateOrderBookForMatching: (orderBook: unknown) => void;
  getOpenOrders: () => never[];
  getConditionalOrders: () => never[];
  getOrderHistory: () => never[];
  getPosition: (symbol: string) => undefined;
  getOCOOrders: () => never[];
  resetAccount: () => void;
}

export const useTradingStore = create<TradingState>()((set) => ({
  orders: [],
  positions: new Map(),
  focusMode: false,
  setFocusMode: (enabled: boolean) => set({ focusMode: enabled }),
  updateOrderBookForMatching: () => {},
  getOpenOrders: () => [],
  getConditionalOrders: () => [],
  getOrderHistory: () => [],
  getPosition: () => undefined,
  getOCOOrders: () => [],
  resetAccount: () => {},
}));

export const selectFocusMode = (state: TradingState) => state.focusMode;
```

- [ ] **Step 2: Create stub walletStore**

Create `src/store/walletStore.ts` as a minimal stub:

```typescript
import { create } from 'zustand';

/**
 * Stub wallet store — replaced in Phase 4 with @liqu-fi/react deposit hooks.
 */
interface WalletState {
  hasReceivedInitialGrant: boolean;
  grantInitialFunds: () => boolean;
  resetWallet: () => void;
}

export const useWalletStore = create<WalletState>()(() => ({
  hasReceivedInitialGrant: true,
  grantInitialFunds: () => true,
  resetWallet: () => {},
}));

export const selectBalances = () => [];
```

- [ ] **Step 3: Stub marketStore — remove Worker usage**

The existing `src/store/marketStore.ts` creates a Web Worker and connects to Binance. Replace the `subscribe` and `unsubscribe` methods with no-ops. This will be replaced in Phase 2 with SSE-based data.

In `src/store/marketStore.ts`, replace the `subscribe` method body (lines ~243-377) with:

```typescript
subscribe: (_symbol: string) => {
  // Stub: real-time data via SSE added in Phase 2
  set({
    orderBook: null,
    metrics: null,
    recentTrades: [],
    connectionStatus: {
      ...initialConnectionStatus,
      state: 'disconnected',
    },
    dataConfidence: getInitialDataConfidence(),
  });
},
```

And the `unsubscribe` method (lines ~380-399) remains as-is but remove the worker termination:

```typescript
unsubscribe: () => {
  set({
    orderBook: null,
    metrics: null,
    recentTrades: [],
    connectionStatus: initialConnectionStatus,
    dataConfidence: getInitialDataConfidence(),
    networkHealth: null,
  });
},
```

Remove the `worker` field from state interface and initial state. Remove the Worker-related imports at the top of the file.

- [ ] **Step 4: Fix DesktopLayout — replace AccountMenu logout with wallet disconnect**

In `src/components/Layout/DesktopLayout.tsx`, the `AccountMenu` component calls `authStore.logout()`. Update it to show the connected wallet address. Replace the AccountMenu import and usage with ConnectKitButton:

```tsx
// Add import at top:
import { ConnectKitButton } from 'connectkit';

// Replace the AccountMenu section (lines 68-72) with:
{isAuthenticated && (
  <div className={styles.accountWrapper}>
    <ConnectKitButton showBalance={false} />
  </div>
)}
```

- [ ] **Step 5: Fix remaining import errors**

Search for any remaining imports of deleted modules and fix:

```bash
grep -rn "from.*automationStore\|from.*AutomationPanel\|from.*marketDataService\|from.*types/wallet\|from.*types/automation" src/ --include="*.ts" --include="*.tsx"
```

For each hit, either remove the import or replace with a stub. Key files likely affected:
- `src/pages/SettingsPage.tsx` — may import automation
- `src/components/BottomTabs/BottomTabs.tsx` — may reference automation tab
- `src/pages/mobile/` — mobile pages may import walletStore

- [ ] **Step 6: Verify app compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Fix any remaining type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: stub deleted stores, remove Worker from marketStore, fix imports"
```

---

### Task 9: Verify app runs in browser

**Files:** None (verification only)

- [ ] **Step 1: Start dev server**

```bash
cd /Users/alex/Work/perps/tbt-paper-terminal
npm run dev
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:5173`. Expected behavior:
1. Redirected to `/auth`
2. See "LIQ TERMINAL" card with "Connect Wallet" button
3. Click "Connect Wallet" → ConnectKit modal opens
4. After connecting → "Sign In to Exchange" button appears
5. (Gateway auth will fail if gateway isn't running — that's OK for now)

- [ ] **Step 3: Verify mobile layout**

Open browser dev tools, toggle mobile view. The auth page should still render (using existing responsive CSS).

- [ ] **Step 4: Commit any fixes found during testing**

```bash
git add -A
git commit -m "fix: resolve runtime issues found during browser testing"
```

---

### Task 10: Clean up and final commit

**Files:**
- Modify: various cleanup

- [ ] **Step 1: Remove dead code references**

Remove any unused imports, dead components, or references to deleted features that weren't caught in Task 8. Check:
- `src/components/Layout/AccountMenu.tsx` — may still reference old authStore methods
- `src/components/Layout/MobileLayout.tsx` — may reference deleted pages
- `src/pages/mobile/WalletPage.mobile.tsx` — consider keeping as stub or removing
- `src/pages/WalletPage.tsx` — removed from routes in Task 7, but file may still exist

- [ ] **Step 2: Update README**

Add a brief note to README.md about the new auth flow:

```markdown
## Development

```bash
cp .env.example .env
# Edit .env with your gateway URL and chain ID
npm install
npm run dev
```

Requires a running [order-gateway](https://github.com/liqu-fi/monorepo) instance for auth and trading.
```

- [ ] **Step 3: Final verification**

```bash
npx tsc --noEmit
npm run dev
```

Verify no type errors, app starts, auth page renders.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: clean up dead code, update README for Phase 1"
```
