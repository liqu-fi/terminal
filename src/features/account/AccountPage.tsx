import { useSessionStage } from "@liq/react";

import { ACCOUNT_TABS, accountHref, type AccountTab } from "@/lib/hashRoute";

import { SessionCta } from "../auth/SessionCta";
import { Panel } from "./AccountCards";
import { OverviewTab } from "./OverviewTab";

const TAB_LABEL: Record<AccountTab, string> = {
  overview: "Overview",
  portfolio: "Portfolio",
  assets: "Assets",
  transactions: "Transactions",
};

/**
 * Полноэкранная страница счёта. Вкладки — настоящие ссылки на хеш: колесо,
 * средняя кнопка и «назад» работают браузером. На стадиях `no-account` /
 * `needs-signin` вместо вкладок стоит тот же `SessionCta`, что и в подвале
 * тикета: иначе с `#/account` было бы некуда войти.
 */
export function AccountPage({ tab }: { tab: AccountTab }) {
  const stage = useSessionStage();
  const onboarding = stage === "no-account" || stage === "needs-signin";

  return (
    <div
      className="scroll-thin min-h-0 flex-1 overflow-y-auto"
      data-testid="account-page"
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 p-4">
        <h1 className="text-lg font-semibold">Account</h1>
        <nav
          className="inline-flex w-fit items-center gap-1 rounded-lg bg-surface-2 p-[3px] text-sm"
          aria-label="Account sections"
        >
          {ACCOUNT_TABS.map((t) => (
            <a
              key={t}
              href={accountHref(t)}
              aria-current={t === tab ? "page" : undefined}
              data-testid={`account-tab-${t}`}
              className={`rounded-md px-3 py-1 font-medium ${
                t === tab ? "bg-surface text-text" : "text-muted hover:text-text"
              }`}
            >
              {TAB_LABEL[t]}
            </a>
          ))}
        </nav>
        {onboarding ? (
          <Panel
            className="flex max-w-sm flex-col gap-2"
            testid="account-session-cta"
          >
            <p className="text-sm text-muted">
              {stage === "no-account"
                ? "Create a trading account to see balances and history."
                : "Sign in to the gateway to see your account."}
            </p>
            <SessionCta stage={stage} />
          </Panel>
        ) : (
          <TabBody tab={tab} />
        )}
      </div>
    </div>
  );
}

function TabBody({ tab }: { tab: AccountTab }) {
  switch (tab) {
    case "overview":
      return <OverviewTab />;
    default:
      // Portfolio, Assets, Transactions добавляются следующими задачами плана.
      return null;
  }
}
