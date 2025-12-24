import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPriority = 'high' | 'normal' | 'low';

export type ToastKey = 
  | `order:${string}:${string}`      // order:orderId:status
  | `connection:${string}`           // connection:state
  | `automation:${string}:${string}`   // automation:triggerId:status
  | `error:${string}`                // error:errorCode
  | `warning:${string}`              // warning:warningType
  | `oco:${string}:${string}`        // oco:groupId:status
  | `trailing:${string}:${string}`;  // trailing:orderId:status

export interface ToastItem {
  id: string;
  key: ToastKey;
  type: ToastType;
  priority: ToastPriority;
  message: string;
  duration?: number;
  timestamp: number;
}

interface NotificationState {
  toasts: ToastItem[];
  suppressedCount: number;
  lastSuppressedMessage: string | null;
  
  add: (config: {
    key: ToastKey;
    type: ToastType;
    priority?: ToastPriority;
    message: string;
    duration?: number;
  }) => void;
  
  remove: (id: string) => void;
  clear: () => void;
}

const DEDUP_WINDOW_MS = 30000; // 30 seconds
const MAX_CONCURRENT = 3;

const priorityOrder: Record<ToastPriority, number> = {
  high: 3,
  normal: 2,
  low: 1,
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  toasts: [],
  suppressedCount: 0,
  lastSuppressedMessage: null,

  add: (config) => {
    const { key, type, priority = 'normal', message, duration } = config;
    const now = Date.now();
    const state = get();

    // Check for duplicate within dedup window
    const recentToast = state.toasts.find(
      t => t.key === key && (now - t.timestamp) < DEDUP_WINDOW_MS
    );
    
    if (recentToast) {
      // Suppress duplicate
      set({
        suppressedCount: state.suppressedCount + 1,
        lastSuppressedMessage: message,
      });
      return;
    }

    // Check queue size
    const currentToasts = [...state.toasts];
    
    // If queue is full, remove lowest priority toast
    if (currentToasts.length >= MAX_CONCURRENT) {
      // Sort by priority (lowest first)
      currentToasts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
      
      // Remove lowest priority toast (but never remove high priority)
      const lowestPriority = currentToasts[0];
      if (lowestPriority && lowestPriority.priority !== 'high' && priorityOrder[priority] > priorityOrder[lowestPriority.priority]) {
        currentToasts.shift();
      } else if (lowestPriority && priorityOrder[priority] <= priorityOrder[lowestPriority.priority]) {
        // New toast has same or lower priority, don't add it
        set({
          suppressedCount: state.suppressedCount + 1,
          lastSuppressedMessage: message,
        });
        return;
      }
    }

    const id = `toast-${now}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastItem = {
      id,
      key,
      type,
      priority,
      message,
      duration,
      timestamp: now,
    };

    set({
      toasts: [...currentToasts, newToast],
      suppressedCount: 0,
      lastSuppressedMessage: null,
    });
  },

  remove: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clear: () => {
    set({
      toasts: [],
      suppressedCount: 0,
      lastSuppressedMessage: null,
    });
  },
}));

// Convenience methods
export const notification = {
  success: (key: ToastKey, message: string, priority: ToastPriority = 'normal', duration?: number) =>
    useNotificationStore.getState().add({ key, type: 'success', priority, message, duration }),
  
  error: (key: ToastKey, message: string, priority: ToastPriority = 'high', duration?: number) =>
    useNotificationStore.getState().add({ key, type: 'error', priority, message, duration }),
  
  warning: (key: ToastKey, message: string, priority: ToastPriority = 'normal', duration?: number) =>
    useNotificationStore.getState().add({ key, type: 'warning', priority, message, duration }),
  
  info: (key: ToastKey, message: string, priority: ToastPriority = 'low', duration?: number) =>
    useNotificationStore.getState().add({ key, type: 'info', priority, message, duration }),
};





