import { create } from 'zustand';

// Minimal balance type to satisfy existing components
export interface StubBalance {
  asset: string;
  available: string;
  frozen: string;
  total: string;
}

export interface StubAccount {
  accountId: string;
  status: string;
}

interface WalletState {
  balances: StubBalance[];
  account: StubAccount | null;
  hasReceivedInitialGrant: boolean;
  performanceMetrics: Record<string, unknown>;
  grantInitialFunds: () => boolean;
  resetWallet: () => void;
  getTotalEquity: (opts: Record<string, unknown>) => string;
  getOnboardingStage: () => string;
  updatePerformanceMetrics: () => void;
}

export const useWalletStore = create<WalletState>()(() => ({
  balances: [],
  account: null,
  hasReceivedInitialGrant: true,
  performanceMetrics: {},
  grantInitialFunds: () => true,
  resetWallet: () => {},
  getTotalEquity: () => '0.00',
  getOnboardingStage: () => 'not_created',
  updatePerformanceMetrics: () => {},
}));

export const selectBalances = (state: WalletState) => state.balances;
export const selectAccount = (state: WalletState) => state.account;
export const selectPaymentMethods = () => [];
export const selectCryptoAddresses = () => [];
export const selectDeposits = () => [];
export const selectWithdraws = () => [];
