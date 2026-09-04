import { env, turnkeyLoginEnabled } from "../../config/env";
import { ConnectButton } from "../wallet/ConnectButton";
import { TurnkeyLoginButton } from "./TurnkeyLoginButton";

/**
 * Экран входа: две двери в одну и ту же сессию.
 *
 * @remarks
 * Turnkey даёт встроенный кошелёк в TEE и не требует расширения; `injected`
 * оставлен как есть. Обе приводят в один и тот же `SessionGate` — дальше
 * терминал не различает, чем подписывают.
 */
export function SignInPanel() {
  return (
    <div className="flex flex-col items-center gap-3">
      {turnkeyLoginEnabled ? <TurnkeyLoginButton /> : null}

      {env.turnkeyConfigError ? (
        <p className="text-sm text-short" role="alert" data-testid="auth-config-error">
          {env.turnkeyConfigError}
        </p>
      ) : null}

      <ConnectButton />
    </div>
  );
}
