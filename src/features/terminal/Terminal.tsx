import { Card } from "../../components/ui/Card";
import { CandleChart } from "../chart/CandleChart";
import { MarketHeader } from "../market/MarketHeader";
import { useSelectedMarket } from "../market/useSelectedMarket";
import { TradeForm } from "../trade/TradeForm";
import { UserInfoTabs } from "../userinfo/UserInfoTabs";

export function Terminal() {
  const { marketId } = useSelectedMarket();
  return (
    <div className="flex flex-1 flex-col gap-3" data-testid="terminal-root">
      <MarketHeader />
      <div className="flex flex-1 gap-3">
        {/* LEFT: trade form */}
        <TradeForm />
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
