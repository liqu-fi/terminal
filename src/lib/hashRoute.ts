import { useSyncExternalStore } from "react";

/** Вкладки страницы Account в порядке макета; слаг — сегмент хеша и часть testid. */
export const ACCOUNT_TABS = [
  "overview",
  "portfolio",
  "assets",
  "transactions",
] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];

export type Route =
  | { view: "trade" }
  | { view: "account"; tab: AccountTab };

const TRADE: Route = { view: "trade" };

/** Хеш торгового экрана. */
export const TRADE_HREF = "#/";

/**
 * Разбор хеша. Всё, что не `#/account[/<tab>]`, — торговый экран: страницы
 * не ломаются от чужих хешей (Turnkey OAuth кладёт в хеш `id_token`).
 */
export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] !== "account") return TRADE;
  if (parts.length === 1) return { view: "account", tab: "overview" };
  const tab = ACCOUNT_TABS.find((t) => t === parts[1]);
  return tab !== undefined && parts.length === 2
    ? { view: "account", tab }
    : TRADE;
}

export function accountHref(tab: AccountTab): string {
  return tab === "overview" ? "#/account" : `#/account/${tab}`;
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/**
 * Живой маршрут из `location.hash`. Хеш никогда не переписывается отсюда:
 * навигация — обычные `<a href="#/…">`, «назад» и deep-link работают браузером.
 */
export function useHashRoute(): Route {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => "",
  );
  return parseRoute(hash);
}
