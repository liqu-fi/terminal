import { create } from 'zustand';
import {
  useGatewayStore,
  selectIsAuthenticated as selectGatewayAuth,
} from '@liq/react';

interface AuthState {
  isAuthenticated: boolean;
}

export const useAuthStore = create<AuthState>()(() => ({
  isAuthenticated: false,
}));

// Sync gateway auth state -> local authStore
useGatewayStore.subscribe((state) => {
  const isAuth = selectGatewayAuth(state);
  const current = useAuthStore.getState().isAuthenticated;
  if (isAuth !== current) {
    useAuthStore.setState({ isAuthenticated: isAuth });
  }
});

// useGatewayStore uses zustand persist middleware — the subscription above
// fires before rehydration with the initial (empty) state. We need to also
// sync after persist has finished rehydrating from localStorage.
useGatewayStore.persist.onFinishHydration((state) => {
  const isAuth = selectGatewayAuth(state);
  useAuthStore.setState({ isAuthenticated: isAuth });
});

export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
