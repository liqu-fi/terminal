import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  email: string;
  lastLogin: number;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  login: (username: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (username: string) => {
        set({ isLoading: true });
        
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        const user: User = {
          id: Math.random().toString(36).substring(2, 9),
          username,
          email: `${username}@example.com`,
          lastLogin: Date.now(),
        };

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'paper-auth-storage',
    }
  )
);

