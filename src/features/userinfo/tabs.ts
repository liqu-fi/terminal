/**
 * Семь вкладок нижней панели в порядке макета (Frame-13).
 *
 * @remarks Слаг — контракт с e2e (`userinfo-tab-{slug}`), поэтому список живёт
 * отдельно от разметки: переименование ярлыка не должно двигать локаторы.
 */
export const USER_TABS = [
  { slug: "positions", label: "Positions" },
  { slug: "open-orders", label: "Open Orders" },
  { slug: "trade-history", label: "Trade History" },
  { slug: "order-history", label: "Order History" },
  { slug: "position-history", label: "Position History" },
  { slug: "funding-history", label: "Funding History" },
  { slug: "account-history", label: "Account History" },
] as const;

export type UserTabSlug = (typeof USER_TABS)[number]["slug"];
