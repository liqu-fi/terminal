import { useEffect } from "react";

import { env } from "../../config/env";
import { requestGasGrant } from "../wallet/gasGrant";
import { useTurnkeyIdentity } from "./TurnkeyIdentityProvider";

/**
 * Просит шлюз налить газа встроенному кошельку — один раз на личность, до
 * создания аккаунта.
 *
 * @remarks
 * Подписывает сам встроенный аккаунт, минуя wagmi: попапа нет, анклав
 * подписывает молча. Исход не блокирует лестницу — `requestGasGrant` не бросает,
 * а «не налили» это обычный ответ вернувшемуся пользователю.
 */
export function GasGrantRunner() {
  const { effect, claim, settle, account, subOrgId } = useTurnkeyIdentity();

  useEffect(() => {
    if (effect.kind !== "gas") return;
    if (!account || !subOrgId) return;
    if (!claim(effect)) return;
    const seq = effect.seq;
    void requestGasGrant({
      gatewayUrl: env.gatewayUrl,
      address: effect.address,
      subOrgId,
      signMessage: ({ message }) => account.signMessage({ message }),
    }).then((outcome) => settle({ step: "gas", seq, outcome }));
  }, [effect, claim, settle, account, subOrgId]);

  return null;
}
