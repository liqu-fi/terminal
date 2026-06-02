import { Card } from "../../components/ui/Card";
import { CandleChart } from "../chart/CandleChart";
import { MarketHeader } from "../market/MarketHeader";
import { useSelectedMarket } from "../market/MarketContext";
import { UserInfoTabs } from "../userinfo/UserInfoTabs";

export function Terminal() {
  const { marketId } = useSelectedMarket();
  return (
    <div className="flex flex-1 flex-col gap-3">
      <MarketHeader />
      <div className="flex flex-1 gap-3">
        {/* LEFT: trade form — implemented in P3 */}
        <Card className="w-[240px] shrink-0 p-3 text-sm text-muted">
          Trade form → P3
        </Card>
        {/* RIGHT: chart + tabbed user info */}
        <div className="flex flex-1 flex-col gap-3">
          <Card className="h-[320px] p-2">
            <CandleChart marketId={marketId} />
          </Card>
          <UserInfoTabs />
        </div>
      </div>
    </div>
  );
}
