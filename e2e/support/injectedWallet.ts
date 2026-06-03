/**
 * Injected EIP-1193 wallet for hermetic tests.
 *
 * An init script installs `window.ethereum` that forwards every request to a
 * Node-side handler (exposed via `page.exposeFunction`) closing over the
 * MockWorld. Signing returns canned signatures (the mock gateway never
 * verifies them); sends mutate the world via `applyWrite` and record a receipt
 * the mock chain will serve back.
 */
import type { Page } from "@playwright/test";
import { numberToHex } from "viem";

import { CHAIN_ID_HEX, TEST_ADDRESS } from "./constants";
import { applyWrite, handleEthCall } from "./chain";
import { type MockWorld, nextTxHash } from "./world";

const DUMMY_SIG = ("0x" + "11".repeat(65)) as string;

interface WalletState {
  connected: boolean;
}

export async function installWallet(
  page: Page,
  world: MockWorld,
): Promise<WalletState> {
  const state: WalletState = { connected: false };

  await page.exposeFunction(
    "__e2eWalletRequest",
    async (method: string, params: unknown[]): Promise<unknown> => {
      switch (method) {
        case "eth_chainId":
          return CHAIN_ID_HEX;
        case "net_version":
          return "6343";
        case "eth_requestAccounts":
          state.connected = true;
          return [TEST_ADDRESS.toLowerCase()];
        case "eth_accounts":
          return state.connected ? [TEST_ADDRESS.toLowerCase()] : [];
        case "personal_sign":
        case "eth_sign":
        case "eth_signTypedData":
        case "eth_signTypedData_v4":
          return DUMMY_SIG;
        case "eth_sendTransaction": {
          const tx = (params[0] ?? {}) as { to?: string; data?: string };
          const to = (tx.to ?? "").toLowerCase();
          const data = tx.data ?? "0x";
          const hash = nextTxHash(world);
          world.sentTxs.push({ hash, to, data, kind: data.slice(0, 10) });
          world.receipts[hash] = applyWrite(world, to, data);
          return hash;
        }
        case "eth_call": {
          const tx = (params[0] ?? {}) as { to?: string; data?: string };
          return handleEthCall(world, (tx.to ?? "").toLowerCase(), tx.data ?? "0x");
        }
        case "eth_estimateGas":
          return "0x5208";
        case "eth_gasPrice":
        case "eth_maxPriorityFeePerGas":
          return "0x3b9aca00";
        case "eth_getTransactionCount":
          return "0x0";
        case "eth_blockNumber":
          return numberToHex(world.blockNumber);
        case "eth_getBalance":
          return "0x56bc75e2d63100000"; // 100 ETH
        case "wallet_switchEthereumChain":
        case "wallet_addEthereumChain":
          return null;
        case "wallet_requestPermissions":
        case "wallet_getPermissions":
          return [{ parentCapability: "eth_accounts" }];
        default:
          // Unknown / unused method — null is the most tolerable response.
          return null;
      }
    },
  );

  await page.addInitScript(
    ({ address }) => {
      const listeners: Record<string, ((...a: unknown[]) => void)[]> = {};
      const provider = {
        isMetaMask: true,
        isE2E: true,
        chainId: "0x18c7",
        selectedAddress: address,
        request: ({
          method,
          params,
        }: {
          method: string;
          params?: unknown[];
        }) =>
          (
            window as unknown as {
              __e2eWalletRequest: (m: string, p: unknown[]) => Promise<unknown>;
            }
          ).__e2eWalletRequest(method, params ?? []),
        on(event: string, fn: (...a: unknown[]) => void) {
          (listeners[event] ??= []).push(fn);
          return provider;
        },
        removeListener(event: string, fn: (...a: unknown[]) => void) {
          listeners[event] = (listeners[event] ?? []).filter((f) => f !== fn);
          return provider;
        },
        removeAllListeners() {
          for (const k of Object.keys(listeners)) listeners[k] = [];
          return provider;
        },
      };
      (window as unknown as { ethereum: unknown }).ethereum = provider;

      // EIP-6963 announcement so wagmi's injected discovery finds it too.
      const info = {
        uuid: "11111111-1111-1111-1111-111111111111",
        name: "E2E Wallet",
        icon: "data:image/svg+xml;base64,PHN2Zy8+",
        rdns: "local.e2e.wallet",
      };
      const announce = () =>
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: Object.freeze({ info, provider }),
          }),
        );
      window.addEventListener("eip6963:requestProvider", announce);
      announce();
    },
    { address: TEST_ADDRESS.toLowerCase() },
  );

  return state;
}
