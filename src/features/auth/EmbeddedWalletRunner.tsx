import { createEmbeddedWallet } from "@liq/turnkey";
import { useEffect } from "react";

import { env } from "../../config/env";
import { useTurnkeyIdentity } from "./TurnkeyIdentityProvider";

/**
 * Разрешает встроенный кошелёк суб-организации — один раз на личность.
 *
 * @remarks
 * Ничего не рисует и ничем не владеет. Гарантию «не более одного раза» даёт
 * отметка `attempts.resolve` плюс `claim()`, а не модульный промис:
 * `createEmbeddedWallet` — это fetch-or-create, и два одновременных разрешения
 * суб-организации без кошелька создадут два кошелька там, где
 * `SnxAccount.owner` — записываемый однажды и не переписываемый — может назвать
 * только один. Аккаунт проигравшего недостижим навсегда.
 */
export function EmbeddedWalletRunner() {
  const { effect, claim, settleResolve } = useTurnkeyIdentity();

  useEffect(() => {
    if (effect.kind !== "resolve-signer") return;
    if (!claim(effect)) return;
    const seq = effect.seq;
    createEmbeddedWallet({
      orgId: env.turnkey.orgId,
      authProxyUrl: env.turnkey.authProxyUrl,
      authProxyConfigId: env.turnkey.authProxyConfigId,
    })
      .then((wallet) =>
        settleResolve(seq, { ok: true, address: wallet.address, account: wallet.account }),
      )
      .catch((error: unknown) => settleResolve(seq, { ok: false, error }));
    // Флага `cancelled` нет намеренно: приземление, чей seq больше не совпадает
    // с записанной попыткой, отбрасывается дважды — `ladderSettle` отказывает
    // диспатчу, а `heldAccountIsCurrent` отказывается показывать аккаунт, даже
    // если его успели записать в ссылку. Этим покрыты и размонтирование, и
    // выход, и повтор.
  }, [effect, claim, settleResolve]);

  return null;
}
