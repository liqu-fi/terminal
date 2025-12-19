// ===== 仿真交易类型 =====

export type OrderStatus =
  | 'pending'      // 本地创建，未提交
  | 'submitted'    // 已提交到仿真引擎
  | 'open'         // 挂单中
  | 'partial'      // 部分成交
  | 'filled'       // 完全成交
  | 'cancelled'    // 已撤销
  | 'rejected';    // 被拒绝（余额不足等）

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'limit' | 'market';

export interface PaperOrder {
  clientOrderId: string;   // 客户端生成的UUID
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: string | null;    // 限价单必填，市价单为null
  quantity: string;        // 下单数量
  filledQty: string;       // 已成交数量
  avgPrice: string;        // 平均成交价格
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  fills: Fill[];           // 成交明细
  rejectReason?: string;   // 拒绝原因
  takeProfitPrice?: string; // 止盈触发价
  stopLossPrice?: string;   // 止损触发价
}

export interface Fill {
  fillId: string;
  price: string;
  quantity: string;
  fee: string;             // 手续费（模拟 0.1%）
  feeAsset: string;        // 手续费币种
  time: number;
  triggerTradeId?: string; // 触发成交的市场 Trade ID
}

export interface Position {
  symbol: string;
  side: 'long' | 'flat';   // 仅支持现货多头，不支持做空（无借币机制）
  quantity: string;        // 持仓数量（base asset）
  avgEntryPrice: string;   // 平均开仓价格
  unrealizedPnl: string;   // 未实现盈亏（基于 mid 价格）
  realizedPnl: string;     // 已实现盈亏（卖出时结算）
  updatedAt: number;
  takeProfitPrice?: string; // 止盈价
  stopLossPrice?: string;   // 止损价
}

export interface AccountBalance {
  asset: string;           // 币种，如 "USDT", "BTC"
  free: string;            // 可用余额
  locked: string;          // 冻结余额（挂单占用）
  total: string;           // 总余额 = free + locked
}

// ===== 订单状态机有效转换 =====

export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['submitted', 'cancelled'],
  submitted: ['open', 'rejected'],
  open: ['partial', 'filled', 'cancelled'],
  partial: ['filled', 'cancelled'],
  filled: [],
  cancelled: [],
  rejected: [],
};

// ===== 订单 UI 约束 =====

export interface OrderUIConstraints {
  canCancel: boolean;
  canModify: boolean;
  displayStyle: 'pending' | 'processing' | 'active' | 'success' | 'cancelled' | 'error';
}

export const ORDER_UI_CONSTRAINTS: Record<OrderStatus, OrderUIConstraints> = {
  pending: { canCancel: true, canModify: true, displayStyle: 'pending' },
  submitted: { canCancel: false, canModify: false, displayStyle: 'processing' },
  open: { canCancel: true, canModify: false, displayStyle: 'active' },
  partial: { canCancel: true, canModify: false, displayStyle: 'active' },
  filled: { canCancel: false, canModify: false, displayStyle: 'success' },
  cancelled: { canCancel: false, canModify: false, displayStyle: 'cancelled' },
  rejected: { canCancel: false, canModify: false, displayStyle: 'error' },
};





