import type { TurnkeyAuthMethodOrder, TurnkeyAuthMethods } from "@liq/react";

/**
 * Конфигурация модалки Turnkey: две двери внутрь.
 *
 * @remarks
 * Код на почту и подпись внешнего кошелька — это два способа доказать личность
 * Turnkey, и только. Обе приводят к одному подписанту: `provisionEmbeddedWallet`
 * кладёт `customWallet` и в `createSuborgParams.emailOtpAuth`, и в `.walletAuth`,
 * так что встроенный кошелёк в TEE есть у суб-организации независимо от того,
 * какой дверью пользователь вошёл. Выбор заканчивается вместе с модалкой — нести
 * его дальше в состояние приложения незачем.
 *
 * Каждый флаг перечислен явно, а не оставлен на умолчания: отсутствующий ключ
 * провайдер разрешает против `enabledProviders` из дашборда, то есть пропуск
 * молча включает то, что включено там. На `walletConfig.chains` этот же класс
 * ошибки уже случался — отсутствующий ключ означал «включено».
 *
 * Вход кошельком НЕ зависит от `VITE_WALLETCONNECT_PROJECT_ID`, хотя
 * `TurnkeyProviderWrapper` строит вокруг него свой `walletConfig`:
 * `TurnkeyProvider` перезаписывает `walletConfig.features.auth` значением
 * `walletAuthEnabled`, а `chains.ethereum.native` включён в обеих ветках
 * обёртки — штамп кошелька собирается и расширения EIP-6963 находятся в любом
 * случае. Project id покупает только сам WalletConnect, то есть мобильные
 * кошельки по QR.
 */
export function turnkeyAuthMethods(): {
  methods: TurnkeyAuthMethods;
  methodOrder: TurnkeyAuthMethodOrder;
} {
  return {
    methods: {
      emailOtpAuthEnabled: true,
      walletAuthEnabled: true,
      smsOtpAuthEnabled: false,
      passkeyAuthEnabled: false,
      googleOauthEnabled: false,
      appleOauthEnabled: false,
      xOauthEnabled: false,
      discordOauthEnabled: false,
      facebookOauthEnabled: false,
    },
    methodOrder: ["email", "wallet"],
  };
}
