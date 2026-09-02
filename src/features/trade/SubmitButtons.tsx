import { Side } from "@liq/sdk";

import { Button } from "@/components/ui/button";

/**
 * Две кнопки подачи — сторона выбирается нажатием, а не хранится в тикете.
 *
 * @remarks Надписи постоянны: макет не показывает ни смены текста, ни причины
 * отказа на самой кнопке. Причина живёт строкой ниже, кнопка при отказе просто
 * неактивна — иначе одно и то же место экрана было бы то призывом к действию,
 * то объяснением, почему действие невозможно.
 */
export function SubmitButtons({
  onSubmit,
  disabled,
  pending,
}: {
  onSubmit: (side: Side) => void;
  disabled: boolean;
  pending: boolean;
}) {
  return (
    <div className="flex gap-2">
      <Button
        variant="long"
        className="flex-1"
        disabled={disabled || pending}
        onClick={() => onSubmit(Side.BUY)}
        data-testid="submit-buy-button"
      >
        Buy / Long
      </Button>
      <Button
        variant="short"
        className="flex-1"
        disabled={disabled || pending}
        onClick={() => onSubmit(Side.SELL)}
        data-testid="submit-sell-button"
      >
        Sell / Short
      </Button>
    </div>
  );
}
