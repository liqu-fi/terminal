import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Один флажок ряда.
 *
 * @remarks Имя флага одно на три роли: `htmlFor` подписи, `id` контрола и
 * `data-testid`. Проп назван `testid`, а не `id`, потому что инвентарь
 * идентификаторов (`src/__tests__/collectTestIds.ts`) считает имена, а не
 * синтаксис их передачи, и знает ровно эту пару имён пропов — под именем
 * `id` все флаги молча выпали бы из снимка, ради которого он существует.
 */
function Flag({
  testid,
  label,
  checked,
  onChange,
  disabled,
}: {
  testid: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={testid}
      className={`flex items-center gap-1.5 text-[11px] ${disabled ? "text-muted/50" : "text-muted"}`}
    >
      <Checkbox
        id={testid}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
        data-testid={testid}
      />
      {label}
    </label>
  );
}

/**
 * Флаги исполнения — рабочие ровно там, где их принимает шлюз.
 *
 * @remarks
 * `IOC` всегда неактивен: срока действия нет ни в теле `POST /orders`, ни в
 * схеме заказов — заказанный `IOC` всегда исполнялся как `GTC`. Флажок
 * показывается, потому что он есть в макете, и объясняет себя подсказкой:
 * рабочий вид у неработающего флага сказал бы неправду о том, как исполнится
 * ордер, а его отсутствие скрыло бы, что макет его просит.
 *
 * `Post Only` имеет смысл только у лимитного вида — на рыночных шлюз отвечает
 * отказом, — поэтому вне лимитной вкладки он тоже неактивен.
 */
export function ExecutionFlags({
  postOnly,
  onPostOnly,
  postOnlyAvailable,
  reduceOnly,
  onReduceOnly,
  tpsl,
  onTpsl,
  tpslAvailable,
}: {
  postOnly: boolean;
  onPostOnly: (v: boolean) => void;
  /** Только мейкерский принимают лишь лимитные виды ордера. */
  postOnlyAvailable: boolean;
  reduceOnly: boolean;
  onReduceOnly: (v: boolean) => void;
  tpsl: boolean;
  onTpsl: (v: boolean) => void;
  /** Прикрепить TP/SL можно к входному ордеру, но не к условному. */
  tpslAvailable: boolean;
}) {
  return (
    <TooltipProvider>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-4">
          <Flag
            testid="flag-post-only"
            label="Post Only"
            checked={postOnly && postOnlyAvailable}
            onChange={onPostOnly}
            disabled={!postOnlyAvailable}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Flag
                  testid="flag-ioc"
                  label="IOC"
                  checked={false}
                  onChange={() => undefined}
                  disabled
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Срок действия ордера шлюз не принимает — все ордера GTC.
            </TooltipContent>
          </Tooltip>
          <Flag
            testid="flag-reduce-only"
            label="Reduce Only"
            checked={reduceOnly}
            onChange={onReduceOnly}
          />
        </div>
        {tpslAvailable && (
          <Flag
            testid="tpsl-toggle"
            label="TP / SL"
            checked={tpsl}
            onChange={onTpsl}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
