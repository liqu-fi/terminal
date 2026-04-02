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

// Fire immediately on load
const initialAuth = selectGatewayAuth(useGatewayStore.getState());
if (initialAuth) {
  useAuthStore.setState({ isAuthenticated: true });
}

export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
