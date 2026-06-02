import { useState } from "react";

import { Card } from "../../components/ui/Card";
import { HistoryTable } from "../history/HistoryTable";
import { OpenOrdersTable } from "../orders/OpenOrdersTable";
import { PositionsTable } from "../positions/PositionsTable";
import { useLiveOrders } from "./useLiveOrders";

const TABS = ["Positions", "Open Orders", "History"] as const;
type Tab = (typeof TABS)[number];

export function UserInfoTabs() {
  useLiveOrders(); // SSE subscription side-effect
  const [tab, setTab] = useState<Tab>("Positions");

  return (
    <Card className="flex-1 p-3">
      <div className="mb-2 flex gap-4 border-b border-border pb-2 text-sm">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? "font-semibold text-text" : "text-muted"}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Positions" && <PositionsTable />}
      {tab === "Open Orders" && <OpenOrdersTable />}
      {tab === "History" && <HistoryTable />}
    </Card>
  );
}
