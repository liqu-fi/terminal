import { OrderSide, OrderType } from './trading';
import { DataConfidenceLevel } from './market';

// ===== Trigger Types =====

export type TriggerType = 'conditional' | 'takeProfit' | 'stopLoss' | 'alert';
export type TriggerStatus = 'armed' | 'paused' | 'blocked' | 'triggered' | 'completed' | 'failed' | 'cancelled' | 'expired';
export type TriggerOperator = 'gte' | 'lte'; // >= / <=
export type CrossDirection = 'up' | 'down'; // 上穿 / 下破
export type QuantityMode = 'fixed' | 'percent';

export interface Trigger {
  id: string;                    // uuid
  symbol: string;                // 交易对
  type: TriggerType;             // 触发器类型
  status: TriggerStatus;         // 当前状态
  statusReason?: string;         // 状态原因（如 blocked 时）
  enabled: boolean;              // 是否启用
  condition: TriggerCondition;   // 触发条件
  action: TriggerAction;         // 触发动作
  positionId?: string;           // 关联持仓（TP/SL 时）
  linkedTriggerId?: string;      // OCO 关联的另一个触发器
  
  // 兼容旧代码的属性
  triggerPrice?: string;         // 触发价格 (旧属性，建议迁移到 condition.threshold)
  
  // 配置
  allowDegraded: boolean;        // 允许 DEGRADED 执行
  repeat: boolean;               // 是否重复触发
  
  // 时间
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;            // 过期时间（GTC 为 undefined）
  lastTriggeredAt?: number;      // 最后触发时间
  
  // 统计
  triggerCount: number;          // 触发次数
  successCount: number;          // 成功次数
  failCount: number;             // 失败次数
}

export interface TriggerCondition {
  priceSource: 'last' | 'bid' | 'ask' | 'mid';  // 价格来源
  operator: TriggerOperator;     // 比较运算符
  threshold: string;             // 阈值（Decimal string）
  direction: CrossDirection;     // 穿越方向
  debounceMs: number;            // 防抖时间（默认 1000ms）
  cooldownMs: number;            // 冷却时间（重复触发用，默认 60000ms）
}

export interface TriggerAction {
  type: 'order' | 'alert';       // 动作类型
  side?: OrderSide;              // 买卖方向
  orderType?: OrderType;         // 订单类型
  limitPrice?: string;           // 限价（limit 订单）
  quantityMode: QuantityMode;    // 数量模式
  quantityValue: string;         // 数量值
  timeInForce?: 'GTC' | 'IOC';   // 有效期（默认 GTC）
}

// ===== Execution Log =====

export type ExecutionResult = 'success' | 'blocked' | 'failed';

export interface ExecutionLog {
  id: string;                    // uuid
  triggerId: string;             // 关联触发器
  firedAt: number;               // 触发时间
  timestamp?: number;            // 触发时间 (兼容性字段)
  
  // 触发时的市场状态
  observedPrice: string;         // 观测价格
  confidenceLevel: DataConfidenceLevel;  // 数据可信度
  confidenceReason: string;      // 可信度原因
  reason?: string;               // 触发原因描述
  
  // 执行结果
  result: ExecutionResult;
  orderId?: string;              // 成功时的订单 ID
  errorCode?: AutomationErrorCode;  // 失败时的错误码
  errorMessage?: string;         // 失败详情
  
  // 对账信息
  executionLatencyMs: number;    // 执行延迟（触发到下单完成）
}

// ===== Error Codes =====

export type AutomationErrorCode =
  | 'INSUFFICIENT_BALANCE'       // 余额不足
  | 'DATA_NOT_RELIABLE'          // 数据不可信
  | 'RATE_LIMITED'               // 触发过快被节流
  | 'ORDER_REJECTED'             // 订单被拒绝
  | 'POSITION_CLOSED'            // 持仓已平（TP/SL）
  | 'TRIGGER_EXPIRED'            // 触发器已过期
  | 'TRIGGER_CANCELLED'          // 触发器已取消
  | 'OCO_CANCELLED'              // OCO 被关联触发器取消
  | 'NETWORK_ERROR'              // 网络错误
  | 'UNKNOWN_ERROR';             // 未知错误


