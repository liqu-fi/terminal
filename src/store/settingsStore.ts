import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types
export type ThemeMode = 'light' | 'dark' | 'system';
export type TimeFormat = '12h' | '24h';
export type DateFormat = 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY';
export type ChartStyle = 'candlestick' | 'line' | 'area';
export type ChartColors = 'greenRed' | 'redGreen';
export type LayoutDensity = 'compact' | 'comfortable' | 'spacious';
export type NotificationFrequency = 'realtime' | 'hourly' | 'daily';

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  fundPasswordSet: boolean;
  antiPhishingCode: string | null;
  sessionTimeout: number; // minutes
  ipWhitelist: string[];
}

export interface TradingSettings {
  defaultSymbol: string;
  orderConfirmation: {
    market: boolean;
    limit: boolean;
    large: boolean;
    largeThreshold: number;
  };
  quickTradeEnabled: boolean;
  soundEffects: {
    enabled: boolean;
    orderFilled: boolean;
    orderCancelled: boolean;
    priceAlert: boolean;
  };
  riskManagement: {
    maxPositionSize: number; // percentage
    dailyLossLimit: number;
    autoStopLoss: boolean;
    defaultLeverage: number;
  };
}

export interface NotificationSettings {
  push: boolean;
  email: boolean;
  sms: boolean;
  types: {
    orderUpdates: boolean;
    priceMovements: boolean;
    securityAlerts: boolean;
    systemAnnouncements: boolean;
    marketingUpdates: boolean;
  };
  frequency: NotificationFrequency;
  quietHours: {
    enabled: boolean;
    from: string; // HH:mm
    to: string;   // HH:mm
  };
}

export interface DisplaySettings {
  theme: ThemeMode;
  accentColor: string;
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
  chartStyle: ChartStyle;
  chartColors: ChartColors;
  layoutDensity: LayoutDensity;
  animations: boolean;
  reducedMotion: boolean;
}

export interface PrivacySettings {
  shareAnalytics: boolean;
  personalizedRecommendations: boolean;
  hideBalances: boolean;
  incognitoMode: boolean;
}

export interface AdvancedSettings {
  wsAutoReconnect: boolean;
  wsReconnectInterval: number; // seconds
  wsMaxRetries: number;
  wsHeartbeatInterval: number; // seconds
  dataRefreshInterval: number; // seconds
  batchUpdates: boolean;
  debugMode: boolean;
  consoleLogging: boolean;
  performanceMonitor: boolean;
  experimentalFeatures: boolean;
}

export interface Device {
  id: string;
  name: string;
  browser: string;
  os: string;
  lastActive: number;
  isCurrent: boolean;
  ip: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  secret: string;
  permissions: ('read' | 'trade' | 'withdraw')[];
  created: number;
  lastUsed: number | null;
  ipRestriction: string[];
}

export interface SettingsState {
  // Security
  security: SecuritySettings;
  devices: Device[];
  apiKeys: ApiKey[];
  
  // Trading
  trading: TradingSettings;
  
  // Notifications
  notifications: NotificationSettings;
  
  // Display
  display: DisplaySettings;
  
  // Privacy
  privacy: PrivacySettings;
  
  // Advanced
  advanced: AdvancedSettings;
  
  // Actions
  updateSecurity: (updates: Partial<SecuritySettings>) => void;
  updateTrading: (updates: Partial<TradingSettings>) => void;
  updateNotifications: (updates: Partial<NotificationSettings>) => void;
  updateDisplay: (updates: Partial<DisplaySettings>) => void;
  updatePrivacy: (updates: Partial<PrivacySettings>) => void;
  updateAdvanced: (updates: Partial<AdvancedSettings>) => void;
  
  // Device management
  addDevice: (device: Omit<Device, 'id'>) => void;
  removeDevice: (deviceId: string) => void;
  
  // API key management
  addApiKey: (apiKey: Omit<ApiKey, 'id' | 'created' | 'lastUsed'>) => void;
  removeApiKey: (keyId: string) => void;
  updateApiKeyLastUsed: (keyId: string) => void;
  
  // Reset
  resetAllSettings: () => void;
  resetCategory: (category: 'security' | 'trading' | 'notifications' | 'display' | 'privacy' | 'advanced') => void;
}

const defaultSecuritySettings: SecuritySettings = {
  twoFactorEnabled: false,
  fundPasswordSet: false,
  antiPhishingCode: null,
  sessionTimeout: 30,
  ipWhitelist: [],
};

const defaultTradingSettings: TradingSettings = {
  defaultSymbol: 'BTCUSDT',
  orderConfirmation: {
    market: true,
    limit: false,
    large: true,
    largeThreshold: 10000,
  },
  quickTradeEnabled: true,
  soundEffects: {
    enabled: true,
    orderFilled: true,
    orderCancelled: true,
    priceAlert: true,
  },
  riskManagement: {
    maxPositionSize: 25,
    dailyLossLimit: 5,
    autoStopLoss: false,
    defaultLeverage: 1,
  },
};

const defaultNotificationSettings: NotificationSettings = {
  push: true,
  email: true,
  sms: false,
  types: {
    orderUpdates: true,
    priceMovements: true,
    securityAlerts: true,
    systemAnnouncements: true,
    marketingUpdates: false,
  },
  frequency: 'realtime',
  quietHours: {
    enabled: false,
    from: '22:00',
    to: '08:00',
  },
};

const defaultDisplaySettings: DisplaySettings = {
  theme: 'dark',
  accentColor: '#58A6FF',
  timeFormat: '24h',
  dateFormat: 'YYYY-MM-DD',
  chartStyle: 'candlestick',
  chartColors: 'greenRed',
  layoutDensity: 'comfortable',
  animations: true,
  reducedMotion: false,
};

const defaultPrivacySettings: PrivacySettings = {
  shareAnalytics: true,
  personalizedRecommendations: true,
  hideBalances: false,
  incognitoMode: false,
};

const defaultAdvancedSettings: AdvancedSettings = {
  wsAutoReconnect: true,
  wsReconnectInterval: 5,
  wsMaxRetries: 10,
  wsHeartbeatInterval: 30,
  dataRefreshInterval: 1,
  batchUpdates: true,
  debugMode: false,
  consoleLogging: false,
  performanceMonitor: false,
  experimentalFeatures: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Initial state
      security: defaultSecuritySettings,
      devices: [
        {
          id: 'current',
          name: 'Current Browser',
          browser: getBrowserName(),
          os: getOSName(),
          lastActive: Date.now(),
          isCurrent: true,
          ip: '',
        },
      ],
      apiKeys: [],
      trading: defaultTradingSettings,
      notifications: defaultNotificationSettings,
      display: defaultDisplaySettings,
      privacy: defaultPrivacySettings,
      advanced: defaultAdvancedSettings,

      // Update actions
      updateSecurity: (updates) =>
        set((state) => ({
          security: { ...state.security, ...updates },
        })),

      updateTrading: (updates) =>
        set((state) => ({
          trading: { ...state.trading, ...updates },
        })),

      updateNotifications: (updates) =>
        set((state) => ({
          notifications: { ...state.notifications, ...updates },
        })),

      updateDisplay: (updates) =>
        set((state) => ({
          display: { ...state.display, ...updates },
        })),

      updatePrivacy: (updates) =>
        set((state) => ({
          privacy: { ...state.privacy, ...updates },
        })),

      updateAdvanced: (updates) =>
        set((state) => ({
          advanced: { ...state.advanced, ...updates },
        })),

      // Device management
      addDevice: (device) =>
        set((state) => ({
          devices: [
            ...state.devices,
            {
              ...device,
              id: Math.random().toString(36).substring(2, 9),
            },
          ],
        })),

      removeDevice: (deviceId) =>
        set((state) => ({
          devices: state.devices.filter((d) => d.id !== deviceId),
        })),

      // API key management
      addApiKey: (apiKey) =>
        set((state) => ({
          apiKeys: [
            ...state.apiKeys,
            {
              ...apiKey,
              id: Math.random().toString(36).substring(2, 9),
              created: Date.now(),
              lastUsed: null,
            },
          ],
        })),

      removeApiKey: (keyId) =>
        set((state) => ({
          apiKeys: state.apiKeys.filter((k) => k.id !== keyId),
        })),

      updateApiKeyLastUsed: (keyId) =>
        set((state) => ({
          apiKeys: state.apiKeys.map((k) =>
            k.id === keyId ? { ...k, lastUsed: Date.now() } : k
          ),
        })),

      // Reset functions
      resetAllSettings: () =>
        set({
          security: defaultSecuritySettings,
          trading: defaultTradingSettings,
          notifications: defaultNotificationSettings,
          display: defaultDisplaySettings,
          privacy: defaultPrivacySettings,
          advanced: defaultAdvancedSettings,
        }),

      resetCategory: (category) => {
        const defaults: Record<string, any> = {
          security: defaultSecuritySettings,
          trading: defaultTradingSettings,
          notifications: defaultNotificationSettings,
          display: defaultDisplaySettings,
          privacy: defaultPrivacySettings,
          advanced: defaultAdvancedSettings,
        };
        set({ [category]: defaults[category] });
      },
    }),
    {
      name: 'paper-settings-storage',
      partialize: (state) => ({
        security: state.security,
        trading: state.trading,
        notifications: state.notifications,
        display: state.display,
        privacy: state.privacy,
        advanced: state.advanced,
        apiKeys: state.apiKeys,
      }),
    }
  )
);

// Helper functions
function getBrowserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  return 'Unknown';
}

function getOSName(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Win')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iOS')) return 'iOS';
  return 'Unknown';
}


