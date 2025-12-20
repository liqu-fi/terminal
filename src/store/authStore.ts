import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Simple hash function for password (simulation only, NOT secure for production)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
  avatar: string | null;
  bio: string;
  timezone: string;
  createdAt: number;
  lastLogin: number;
}

export interface UserPreferences {
  language: 'zh-CN' | 'en-US';
  theme: 'light' | 'dark' | 'system';
  quoteAsset: 'USDT' | 'BTC';
  notifications: {
    priceThreshold: number;
    orderFills: boolean;
  };
}

// Store all registered users for login validation
interface RegisteredUsers {
  [username: string]: {
    passwordHash: string;
    userId: string;
  };
}

interface AuthState {
  user: User | null;
  preferences: UserPreferences;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  registeredUsers: RegisteredUsers;
  
  // Actions
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (updates: Partial<Pick<User, 'displayName' | 'bio' | 'timezone'>>) => void;
  updateAvatar: (dataUrl: string | null) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  changePassword: (oldPass: string, newPass: string) => { success: boolean; error?: string };
  markAsInitialized: () => void;
}

const defaultPreferences: UserPreferences = {
  language: 'zh-CN',
  theme: 'dark',
  quoteAsset: 'USDT',
  notifications: {
    priceThreshold: 5,
    orderFills: true,
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      preferences: defaultPreferences,
      isAuthenticated: false,
      isInitialized: false,
      isLoading: false,
      registeredUsers: {},

      register: async (username: string, password: string) => {
        set({ isLoading: true });
        
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 800));
        
        const state = get();
        
        // Check if username already exists
        if (state.registeredUsers[username.toLowerCase()]) {
          set({ isLoading: false });
          return { success: false, error: 'userExists' };
        }
        
        const passwordHash = simpleHash(password);
        const userId = Math.random().toString(36).substring(2, 9);
        const now = Date.now();
        
        const user: User = {
          id: userId,
          username,
          email: `${username}@paper.trading`,
          passwordHash,
          displayName: username,
          avatar: null,
          bio: '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          createdAt: now,
          lastLogin: now,
        };

        set((state) => ({
          user,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: false, // Will be set to true after initial grant
          registeredUsers: {
            ...state.registeredUsers,
            [username.toLowerCase()]: {
              passwordHash,
              userId,
            },
          },
        }));
        
        return { success: true };
      },

      login: async (username: string, password: string) => {
        set({ isLoading: true });
        
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 800));
        
        const state = get();
        const registeredUser = state.registeredUsers[username.toLowerCase()];
        
        if (!registeredUser) {
          set({ isLoading: false });
          return { success: false, error: 'invalidCredentials' };
        }
        
        const passwordHash = simpleHash(password);
        if (registeredUser.passwordHash !== passwordHash) {
          set({ isLoading: false });
          return { success: false, error: 'invalidCredentials' };
        }
        
        // Restore user data if available, or create minimal user object
        const existingUser = state.user?.id === registeredUser.userId ? state.user : null;
        const now = Date.now();
        
        const user: User = existingUser ? {
          ...existingUser,
          lastLogin: now,
        } : {
          id: registeredUser.userId,
          username,
          email: `${username}@paper.trading`,
          passwordHash,
          displayName: username,
          avatar: null,
          bio: '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          createdAt: now,
          lastLogin: now,
        };

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
        
        return { success: true };
      },

      logout: () => {
        // Clear wallet and trading data for privacy
        // Import dynamically to avoid circular dependencies
        import('./walletStore').then(({ useWalletStore }) => {
          useWalletStore.getState().resetWallet();
        });
        import('./tradingStore').then(({ useTradingStore }) => {
          useTradingStore.getState().resetAccount();
        });
        
        set({ 
          user: null, 
          isAuthenticated: false,
          isInitialized: false,
          // Keep preferences and registered users for next login
        });
      },

      updateProfile: (updates) => {
        set((state) => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              ...updates,
            },
          };
        });
      },

      updateAvatar: (dataUrl) => {
        set((state) => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              avatar: dataUrl,
            },
          };
        });
      },

      updatePreferences: (prefs) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            ...prefs,
            notifications: {
              ...state.preferences.notifications,
              ...(prefs.notifications || {}),
            },
          },
        }));
      },

      changePassword: (oldPass, newPass) => {
        const state = get();
        if (!state.user) {
          return { success: false, error: 'notLoggedIn' };
        }
        
        const oldHash = simpleHash(oldPass);
        if (state.user.passwordHash !== oldHash) {
          return { success: false, error: 'incorrectPassword' };
        }
        
        const newHash = simpleHash(newPass);
        
        set((s) => {
          if (!s.user) return {};
          const usernameKey = s.user.username.toLowerCase();
          const registeredUser = s.registeredUsers[usernameKey];
          if (!registeredUser) return {};
          
          return {
            user: { ...s.user, passwordHash: newHash },
            registeredUsers: {
              ...s.registeredUsers,
              [usernameKey]: {
                ...registeredUser,
                passwordHash: newHash,
              },
            },
          };
        });
        
        return { success: true };
      },

      markAsInitialized: () => {
        set({ isInitialized: true });
      },
    }),
    {
      name: 'paper-auth-storage',
      version: 2,
      partialize: (state) => ({
        user: state.user,
        preferences: state.preferences,
        isAuthenticated: state.isAuthenticated,
        isInitialized: state.isInitialized,
        registeredUsers: state.registeredUsers,
      }),
      migrate: (persistedState: unknown, version: number) => {
        // Version 1 -> 2: Add new fields
        if (version < 2) {
          const state = persistedState as Partial<AuthState>;
          return {
            ...state,
            preferences: state.preferences || defaultPreferences,
            isInitialized: state.isInitialized ?? false,
            registeredUsers: state.registeredUsers || {},
            user: state.user ? {
              ...state.user,
              passwordHash: state.user.passwordHash || '',
              displayName: state.user.displayName || state.user.username || '',
              avatar: state.user.avatar || null,
              bio: state.user.bio || '',
              timezone: state.user.timezone || 'UTC',
              createdAt: state.user.createdAt || Date.now(),
            } : null,
          } as AuthState;
        }
        return persistedState as AuthState;
      },
    }
  )
);

// Selectors
export const selectUser = (state: AuthState) => state.user;
export const selectPreferences = (state: AuthState) => state.preferences;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectIsInitialized = (state: AuthState) => state.isInitialized;
