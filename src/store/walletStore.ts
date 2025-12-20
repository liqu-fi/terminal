import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import type {
  Account,
  WalletBalance,
  PaymentMethod,
  CryptoAddress,
  ChainType,
  Deposit,
  DepositStatus,
  Withdraw,
  LedgerEntry,
  LedgerType,
  ReferenceType,
  OnboardingStage,
  LedgerFilter,
  PerformanceMetrics,
} from '../types/wallet';

// ===== Constants =====
const WITHDRAW_FEE_RATE = 0.001; // 0.1%
const MIN_WITHDRAW_FEE = 1; // 1 USDT minimum
// Deposit/Withdraw timing constants (reserved for future use)
// const DEPOSIT_CONFIRM_MIN_MS = 3000;
// const DEPOSIT_CONFIRM_MAX_MS = 10000;
// const WITHDRAW_PROCESS_MIN_MS = 5000;
// const WITHDRAW_PROCESS_MAX_MS = 15000;

const SUPPORTED_ASSETS = [
  'USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK',
  'MATIC', 'ARB', 'OP', 'APT', 'SUI', 'UNI', 'AAVE', 'LDO', 'FET', 'RENDER', 'WLD',
  'AXS', 'SAND', 'MANA', 'LTC', 'ATOM', 'NEAR', 'FIL', 'INJ', 'PEPE',
];

const createEmptyBalances = (): WalletBalance[] => 
  SUPPORTED_ASSETS.map(asset => ({
    asset,
    available: '0',
    frozen: '0',
    total: '0',
  }));

interface WalletState {
  account: Account | null;
  balances: WalletBalance[];
  paymentMethods: PaymentMethod[];
  cryptoAddresses: CryptoAddress[];
  deposits: Deposit[];
  withdraws: Withdraw[];
  ledger: LedgerEntry[];
  performanceMetrics: PerformanceMetrics;
  _pendingTimers: Map<string, ReturnType<typeof setTimeout>>;
  hasReceivedInitialGrant: boolean;
  
  // Actions
  createAccount: () => Account;
  addPaymentMethod: (bankName: string, lastFour: string, alias: string) => PaymentMethod;
  removePaymentMethod: (id: string) => void;
  addCryptoAddress: (chain: ChainType, address: string, alias: string) => CryptoAddress;
  removeCryptoAddress: (id: string) => void;
  
  createDeposit: (asset: string, amount: string, sourceType: 'bank' | 'crypto', sourceId: string) => Deposit;
  confirmDeposit: (depositId: string) => void;
  createWithdraw: (asset: string, amount: string, destinationType: 'bank' | 'crypto', destinationId: string) => Withdraw | null;
  
  // Initial Grant (only once per account)
  grantInitialFunds: () => boolean;
  
  // Strict Balance Actions
  freezeBalance: (asset: string, amount: string, referenceId: string, referenceType: ReferenceType) => boolean;
  unfreezeBalance: (asset: string, amount: string, referenceId: string, referenceType: ReferenceType) => boolean;
  deductFromFrozen: (asset: string, amount: string, fee: string, referenceId: string, referenceType: ReferenceType) => boolean;
  creditToAvailable: (asset: string, amount: string, referenceId: string, referenceType: ReferenceType) => boolean;
  
  // Getters & Utils
  getOnboardingStage: () => OnboardingStage;
  getBalance: (asset: string) => WalletBalance | undefined;
  getTotalEquity: (prices: Record<string, string>) => string;
  getFilteredLedger: (filter: LedgerFilter) => LedgerEntry[];
  updatePerformanceMetrics: (prices: Record<string, string>) => void;
  resetWallet: () => void;
}

export const useWalletStore = create<WalletState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        account: null,
        balances: createEmptyBalances(),
        paymentMethods: [],
        cryptoAddresses: [],
        deposits: [],
        withdraws: [],
        ledger: [],
        performanceMetrics: {
          totalTrades: 0,
          winRate: 0,
          profitFactor: 0,
          maxDrawdown: 0,
          peakEquity: '0',
          totalRealizedPnl: '0',
        },
        _pendingTimers: new Map(),
        hasReceivedInitialGrant: false,

        createAccount: () => {
          const account: Account = {
            accountId: `PTT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            status: 'active',
            createdAt: Date.now(),
          };
          set({ account });
          return account;
        },

        addPaymentMethod: (bankName, lastFour, alias) => {
          const method: PaymentMethod = { id: uuidv4(), type: 'bank', bankName, lastFour, alias, createdAt: Date.now() };
          set((state) => ({ paymentMethods: [...state.paymentMethods, method] }));
          return method;
        },

        removePaymentMethod: (id) => set((state) => ({ paymentMethods: state.paymentMethods.filter((m) => m.id !== id) })),

        addCryptoAddress: (chain, address, alias) => {
          const addr: CryptoAddress = { id: uuidv4(), chain, address, alias, createdAt: Date.now() };
          set((state) => ({ cryptoAddresses: [...state.cryptoAddresses, addr] }));
          return addr;
        },

        removeCryptoAddress: (id) => set((state) => ({ cryptoAddresses: state.cryptoAddresses.filter((a) => a.id !== id) })),

        grantInitialFunds: () => {
          const state = get();
          
          // Prevent duplicate grants
          if (state.hasReceivedInitialGrant) {
            return false;
          }
          
          // Create account if not exists
          let account = state.account;
          if (!account) {
            account = {
              accountId: `PTT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
              status: 'active',
              createdAt: Date.now(),
            };
          }
          
          const grantId = `grant_${uuidv4().slice(0, 8)}`;
          const grantAmount = '300000';
          
          // Update USDT balance
          const newBalances = state.balances.map(b => {
            if (b.asset === 'USDT') {
              const newAvailable = new Decimal(b.available).plus(grantAmount);
              const newTotal = new Decimal(b.total).plus(grantAmount);
              return {
                ...b,
                available: newAvailable.toFixed(8),
                total: newTotal.toFixed(8),
              };
            }
            return b;
          });
          
          const balanceAfter = newBalances.find(b => b.asset === 'USDT')?.available || grantAmount;
          
          // Create ledger entry
          const entry: LedgerEntry = {
            entryId: `led_${uuidv4().slice(0, 8)}`,
            type: 'INITIAL_GRANT',
            direction: '+',
            asset: 'USDT',
            amount: grantAmount,
            fee: '0',
            balanceAfter,
            referenceType: 'grant',
            referenceId: grantId,
            note: 'Welcome bonus / 欢迎赠金',
            createdAt: Date.now(),
          };
          
          // Auto-bind "中国人名很行" bank card
          const bankCard: PaymentMethod = {
            id: uuidv4(),
            type: 'bank',
            bankName: '中国人名很行',
            lastFour: '8888',
            alias: 'Unlimited Card',
            createdAt: Date.now(),
          };
          
          set({
            account,
            balances: newBalances,
            ledger: [entry, ...state.ledger],
            paymentMethods: [bankCard, ...state.paymentMethods],
            hasReceivedInitialGrant: true,
          });
          
          return true;
        },

        createDeposit: (asset, amount, sourceType, sourceId) => {
          const deposit: Deposit = {
            depositId: `dep_${uuidv4().slice(0, 8)}`,
            asset, amount, sourceType, sourceId,
            status: 'pending',
            createdAt: Date.now(),
          };
          set((state) => ({ deposits: [deposit, ...state.deposits] }));

          const delay = 3000 + Math.random() * 5000;
          const timer = setTimeout(() => get().confirmDeposit(deposit.depositId), delay);
          get()._pendingTimers.set(deposit.depositId, timer);

          return deposit;
        },

        confirmDeposit: (depositId) => {
          const state = get();
          const deposit = state.deposits.find((d) => d.depositId === depositId);
          
          // Guard: Only confirm if deposit exists and is pending
          if (!deposit || deposit.status !== 'pending') {
            // Clean up any stale timer
            const timer = state._pendingTimers.get(depositId);
            if (timer) {
              clearTimeout(timer);
              state._pendingTimers.delete(depositId);
            }
            return;
          }

          // Check if we already have a ledger entry for this deposit (prevent duplicate)
          const existingEntry = state.ledger.find(
            e => e.referenceType === 'deposit' && e.referenceId === depositId && e.type === 'DEPOSIT'
          );
          if (existingEntry) {
            // Already confirmed, just update deposit status
            const timer = state._pendingTimers.get(depositId);
            if (timer) {
              clearTimeout(timer);
              state._pendingTimers.delete(depositId);
            }
            set({
              deposits: state.deposits.map(d => 
                d.depositId === depositId ? { ...d, status: 'confirmed', confirmedAt: Date.now() } : d
              ),
            });
            return;
          }

          const timer = state._pendingTimers.get(depositId);
          if (timer) clearTimeout(timer);
          state._pendingTimers.delete(depositId);

          const amountDec = new Decimal(deposit.amount);
          const newBalances = state.balances.map(b => {
            if (b.asset === deposit.asset) {
              const available = new Decimal(b.available).plus(amountDec);
              const total = new Decimal(b.total).plus(amountDec);
              return { ...b, available: available.toFixed(8), total: total.toFixed(8) };
            }
            return b;
          });

          const balanceAfter = newBalances.find(b => b.asset === deposit.asset)?.available || '0';
          const entry: LedgerEntry = {
            entryId: `led_${uuidv4().slice(0, 8)}`,
            type: 'DEPOSIT', direction: '+',
            asset: deposit.asset, amount: deposit.amount, fee: '0',
            balanceAfter, referenceType: 'deposit', referenceId: depositId,
            createdAt: Date.now()
          };

          set({
            balances: newBalances,
            deposits: state.deposits.map(d => d.depositId === depositId ? { ...d, status: 'confirmed', confirmedAt: Date.now() } : d),
            ledger: [entry, ...state.ledger]
          });
        },

        createWithdraw: (asset, amount, destinationType, destinationId) => {
          const state = get();
          const balance = state.balances.find(b => b.asset === asset);
          if (!balance) return null;

          const amountDec = new Decimal(amount);
          const fee = Decimal.max(amountDec.times(WITHDRAW_FEE_RATE), asset === 'USDT' ? MIN_WITHDRAW_FEE : 0);
          const totalRequired = amountDec.plus(fee);

          if (new Decimal(balance.available).lt(totalRequired)) return null;

          const withdrawId = `wdr_${uuidv4().slice(0, 8)}`;
          const success = get().freezeBalance(asset, totalRequired.toFixed(8), withdrawId, 'withdraw');
          
          if (!success) return null;

          const withdraw: Withdraw = {
            withdrawId, asset, amount, fee: fee.toFixed(8),
            destinationType, destinationId, status: 'processing',
            createdAt: Date.now()
          };

          set(s => ({ withdraws: [withdraw, ...s.withdraws] }));

          setTimeout(() => {
            const s = get();
            const w = s.withdraws.find(x => x.withdrawId === withdrawId);
            if (!w || w.status !== 'processing') return;

            const finalSuccess = get().deductFromFrozen(asset, amount, fee.toFixed(8), withdrawId, 'withdraw');
            if (finalSuccess) {
              set(state => ({
                withdraws: state.withdraws.map(x => x.withdrawId === withdrawId ? { ...x, status: 'completed', completedAt: Date.now() } : x)
              }));
            }
          }, 5000 + Math.random() * 5000);

          return withdraw;
        },

        freezeBalance: (asset, amount, referenceId, referenceType) => {
          const state = get();
          const amountDec = new Decimal(amount);
          const balance = state.balances.find(b => b.asset === asset);
          
          if (!balance || new Decimal(balance.available).lt(amountDec)) return false;

          const newBalances = state.balances.map(b => {
            if (b.asset === asset) {
              return {
                ...b,
                available: new Decimal(b.available).minus(amountDec).toFixed(8),
                frozen: new Decimal(b.frozen).plus(amountDec).toFixed(8)
              };
            }
            return b;
          });

          const balanceAfter = newBalances.find(b => b.asset === asset)?.available || '0';
          const entry: LedgerEntry = {
            entryId: `led_${uuidv4().slice(0, 8)}`,
            type: referenceType === 'order' ? 'ORDER_FREEZE' : 'WITHDRAW_FREEZE',
            direction: '-', asset, amount, fee: '0', balanceAfter,
            referenceType, referenceId, createdAt: Date.now()
          };

          set({ balances: newBalances, ledger: [entry, ...state.ledger] });
          return true;
        },

        unfreezeBalance: (asset, amount, referenceId, referenceType) => {
          const state = get();
          const amountDec = new Decimal(amount);
          const balance = state.balances.find(b => b.asset === asset);
          
          if (!balance || new Decimal(balance.frozen).lt(amountDec)) return false;

          const newBalances = state.balances.map(b => {
            if (b.asset === asset) {
              return {
                ...b,
                available: new Decimal(b.available).plus(amountDec).toFixed(8),
                frozen: new Decimal(b.frozen).minus(amountDec).toFixed(8)
              };
            }
            return b;
          });

          const balanceAfter = newBalances.find(b => b.asset === asset)?.available || '0';
          const entry: LedgerEntry = {
            entryId: `led_${uuidv4().slice(0, 8)}`,
            type: referenceType === 'order' ? 'ORDER_UNFREEZE' : 'WITHDRAW_REFUND',
            direction: '+', asset, amount, fee: '0', balanceAfter,
            referenceType, referenceId, createdAt: Date.now()
          };

          set({ balances: newBalances, ledger: [entry, ...state.ledger] });
          return true;
        },

        deductFromFrozen: (asset, amount, fee, referenceId, referenceType) => {
          const state = get();
          const totalDeduct = new Decimal(amount).plus(new Decimal(fee));
          const balance = state.balances.find(b => b.asset === asset);
          
          if (!balance || new Decimal(balance.frozen).lt(totalDeduct)) return false;

          const newBalances = state.balances.map(b => {
            if (b.asset === asset) {
              return {
                ...b,
                frozen: new Decimal(b.frozen).minus(totalDeduct).toFixed(8),
                total: new Decimal(b.total).minus(totalDeduct).toFixed(8)
              };
            }
            return b;
          });

          const balanceAfter = newBalances.find(b => b.asset === asset)?.total || '0';
          const entry: LedgerEntry = {
            entryId: `led_${uuidv4().slice(0, 8)}`,
            type: referenceType === 'withdraw' ? 'WITHDRAW_COMPLETE' : 'FILL',
            direction: '-', asset, amount, fee, balanceAfter,
            referenceType, referenceId, createdAt: Date.now()
          };

          set({ balances: newBalances, ledger: [entry, ...state.ledger] });
          return true;
        },

        creditToAvailable: (asset, amount, referenceId, referenceType) => {
          const state = get();
          const amountDec = new Decimal(amount);
          const newBalances = state.balances.map(b => {
            if (b.asset === asset) {
              return {
                ...b,
                available: new Decimal(b.available).plus(amountDec).toFixed(8),
                total: new Decimal(b.total).plus(amountDec).toFixed(8)
              };
            }
            return b;
          });

          const balanceAfter = newBalances.find(b => b.asset === asset)?.available || '0';
          const entry: LedgerEntry = {
            entryId: `led_${uuidv4().slice(0, 8)}`,
            type: referenceType === 'deposit' ? 'DEPOSIT' : 'FILL',
            direction: '+', asset, amount, fee: '0', balanceAfter,
            referenceType, referenceId, createdAt: Date.now()
          };

          set({ balances: newBalances, ledger: [entry, ...state.ledger] });
          return true;
        },

        getOnboardingStage: () => {
          const s = get();
          if (!s.account) return 'not_created';
          if (s.paymentMethods.length === 0 && s.cryptoAddresses.length === 0) return 'no_payment_method';
          if (!s.balances.some(b => new Decimal(b.total).gt(0))) return 'no_funds';
          return 'funded';
        },

        getBalance: (asset) => get().balances.find(b => b.asset === asset),

        getTotalEquity: (prices) => {
          const s = get();
          let total = new Decimal(0);
          for (const b of s.balances) {
            const qty = new Decimal(b.total);
            if (qty.lte(0)) continue;
            if (b.asset === 'USDT') {
              total = total.plus(qty);
            } else {
              const p = prices[`${b.asset}USDT`];
              if (p && !isNaN(parseFloat(p))) {
                total = total.plus(qty.times(p));
              }
              // Skip assets without current price to avoid crashes
            }
          }
          return total.toFixed(2);
        },

        getFilteredLedger: (filter) => {
          const s = get();
          if (filter === 'all') return s.ledger;
          const types: Record<LedgerFilter, LedgerType[]> = {
            all: [],
            deposit: ['DEPOSIT'],
            withdraw: ['WITHDRAW_FREEZE', 'WITHDRAW_COMPLETE', 'WITHDRAW_REFUND'],
            trade: ['ORDER_FREEZE', 'ORDER_UNFREEZE', 'FILL'],
            fee: ['FEE']
          };
          const selectedTypes = types[filter];
          return s.ledger.filter(e => selectedTypes.includes(e.type));
        },

        updatePerformanceMetrics: (prices) => {
          const s = get();
          const equityValue = s.getTotalEquity(prices);
          const currentEquity = new Decimal(equityValue);
          const m = { ...s.performanceMetrics };
          const peak = new Decimal(m.peakEquity);
          if (currentEquity.gt(peak)) m.peakEquity = currentEquity.toFixed(2);
          else if (peak.gt(0)) {
            const dd = peak.minus(currentEquity).div(peak).times(100).toNumber();
            m.maxDrawdown = Math.max(m.maxDrawdown, dd);
          }
          set({ performanceMetrics: m });
        },

        resetWallet: () => {
          get()._pendingTimers.forEach(clearTimeout);
          set({ account: null, balances: createEmptyBalances(), paymentMethods: [], cryptoAddresses: [], deposits: [], withdraws: [], ledger: [], hasReceivedInitialGrant: false });
        }
      }),
      {
        name: 'paper-wallet-storage',
        version: 3,
        partialize: (s) => ({ account: s.account, balances: s.balances, paymentMethods: s.paymentMethods, cryptoAddresses: s.cryptoAddresses, deposits: s.deposits, withdraws: s.withdraws, ledger: s.ledger, hasReceivedInitialGrant: s.hasReceivedInitialGrant }),
        onRehydrateStorage: () => (s) => {
          if (s) {
            s._pendingTimers = new Map();
            // Only set timers for deposits that are truly pending and not already confirmed
            s.deposits.filter(d => d.status === 'pending').forEach(d => {
              // Skip if there's already a ledger entry for this deposit (indicates it was confirmed)
              const hasLedgerEntry = s.ledger.some(
                e => e.referenceType === 'deposit' && e.referenceId === d.depositId && e.type === 'DEPOSIT'
              );
              if (hasLedgerEntry) {
                // Fix inconsistent state: mark as confirmed
                d.status = 'confirmed' as DepositStatus;
                d.confirmedAt = Date.now();
                return;
              }
              
              const elapsed = Date.now() - d.createdAt;
              const timer = setTimeout(() => s.confirmDeposit(d.depositId), Math.max(5000 - elapsed, 1000));
              s._pendingTimers.set(d.depositId, timer);
            });
          }
        }
      }
    )
  )
);

// ===== Selectors =====
export const selectAccount = (state: WalletState) => state.account;
export const selectBalances = (state: WalletState) => state.balances;
export const selectPaymentMethods = (state: WalletState) => state.paymentMethods;
export const selectCryptoAddresses = (state: WalletState) => state.cryptoAddresses;
export const selectDeposits = (state: WalletState) => state.deposits;
export const selectWithdraws = (state: WalletState) => state.withdraws;
export const selectLedger = (state: WalletState) => state.ledger;
export const selectOnboardingStage = (state: WalletState) => state.getOnboardingStage();
