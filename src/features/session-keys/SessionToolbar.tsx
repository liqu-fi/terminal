import { selectIsAuthenticated, useGatewayStore } from "@liq/react";

import { SessionKeyButton } from "./SessionKeyButton";

/**
 * Пилюля 1-click в шапке приложения.
 *
 * @remarks Раньше она жила отдельной строкой над терминалом (`justify-end px-3
 * pt-2`) и стоила 36px высоты ради одной кнопки — на экране 1280×800 это
 * заметная доля того, что остаётся раскладке. Гейт по аутентификации переехал
 * сюда вместе с ней: до входа в шлюз кнопки нет, как и было.
 */
export function SessionToolbar() {
  const isAuthenticated = useGatewayStore(selectIsAuthenticated);
  if (!isAuthenticated) return null;
  return (
    <div className="flex items-center" data-testid="session-toolbar">
      <SessionKeyButton />
    </div>
  );
}
