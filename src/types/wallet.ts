// ===== Wallet Types =====

// ===== Account =====
export type AccountStatus = 'pending' | 'active' | 'suspended';

export interface Account {
  accountId: string;           // PTT-xxxxxx
  status: AccountStatus;
  createdAt: number;
}

// ===== Wallet Balance =====
export interface WalletBalance {
  asset: string;      // USDT, BTC, ETH, ...
  available: string;  // Decimal string
  frozen: string;     // Decimal string
  total: string;      // available + frozen
}

// ===== Payment Method (Bank Card Mock) =====
export interface PaymentMethod {
  id: string;         // uuid
  type: 'bank';
  bankName: string;   // 银行名称
  lastFour: string;   // 后四位
  alias: string;      // 用户备注名
  createdAt: number;
}

// ===== Address Book (Crypto Address Mock) =====
export type ChainType = 'TRC20' | 'ERC20' | 'BEP20';

export interface CryptoAddress {
  id: string;         // uuid
  chain: ChainType;
  address: string;    // 完整地址
  alias: string;      // 用户备注名
  createdAt: number;
}

// ===== Deposit =====
export type DepositStatus = 'pending' | 'confirmed' | 'failed';

export interface Deposit {
  depositId: string;
  asset: string;
  amount: string;
  sourceType: 'bank' | 'crypto';
  sourceId: string;   // PaymentMethod.id 或 CryptoAddress.id
  status: DepositStatus;
  createdAt: number;
  confirmedAt?: number;
}

// ===== Withdraw =====
export type WithdrawStatus = 'processing' | 'completed' | 'failed';

export interface Withdraw {
  withdrawId: string;
  asset: string;
  amount: string;
  fee: string;
  destinationType: 'bank' | 'crypto';
  destinationId: string;
  status: WithdrawStatus;
  createdAt: number;
  completedAt?: number;
}

// ===== Ledger Entry =====
export type LedgerType = 
  | 'DEPOSIT' 
  | 'WITHDRAW_FREEZE' 
  | 'WITHDRAW_COMPLETE' 
  | 'WITHDRAW_REFUND'
  | 'ORDER_FREEZE' 
  | 'ORDER_UNFREEZE' 
  | 'FILL' 
  | 'FEE'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'INITIAL_GRANT';

export type ReferenceType = 'deposit' | 'withdraw' | 'order' | 'fill' | 'transfer' | 'grant';

export interface LedgerEntry {
  entryId: string;
  type: LedgerType;
  direction: '+' | '-';     // 增加或减少
  asset: string;
  amount: string;
  fee: string;              // 该笔操作的手续费
  balanceAfter: string;     // 操作后余额快照
  referenceType: ReferenceType;
  referenceId: string;
  note?: string;
  createdAt: number;
}

// ===== Onboarding Stage =====
export type OnboardingStage = 
  | 'not_created'      // 未开户
  | 'no_payment_method' // 已开户未绑定
  | 'no_funds'         // 已绑定无资金
  | 'funded';          // 有资金

// ===== Ledger Filter =====
export type LedgerFilter = 'all' | 'deposit' | 'withdraw' | 'trade' | 'fee';

// ===== Performance Metrics =====
export interface PerformanceMetrics {
  totalTrades: number;
  winRate: number;          // 胜率 (0-1)
  profitFactor: number;     // 盈亏比
  maxDrawdown: number;      // 最大回撤 %
  peakEquity: string;       // 最高权益 (USDT)
  totalRealizedPnl: string; // 总已实现盈亏 (USDT)
}


