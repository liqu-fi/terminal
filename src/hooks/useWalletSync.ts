import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useGatewayStore } from '@liq/react';

/**
 * Clears gateway auth token when wallet disconnects.
 * Without this, disconnecting wallet leaves the app in a broken
 * authenticated state where wallet-requiring actions fail.
 */
export function useWalletSync() {
	const { isConnected } = useAccount();

	useEffect(() => {
		if (!isConnected) {
			const store = useGatewayStore.getState();
			if (store.token) {
				store.clearToken();
			}
		}
	}, [isConnected]);
}
