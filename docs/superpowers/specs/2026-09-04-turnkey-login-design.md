# Вход через Turnkey — дизайн

**Дата:** 2026-09-04
**Статус:** утверждён
**Ветка:** `feat-cld/turnkey-login`
**Референс:** `perps/liqu` (`src/features/auth/*`, `src/features/wallet/*`, `src/providers/*`),
пакеты `@liqpro/liq-turnkey@0.47`, `@liqpro/liq-react@0.47`, `@liqpro/liq-core@0.47`

## Задача

Добавить в эталонный терминал вход через авторизацию Turnkey: пользователь входит по коду на
почту (или подписью внешнего кошелька) и торгует со **встроенного кошелька в TEE**, который
Turnkey создаёт его суб-организации. Сегодня единственная дверь — расширение браузера
(`injected()`), то есть терминал недоступен тому, у кого кошелька нет.

Turnkey в терминале уже присутствует, но в другой роли: `TurnkeyProviderWrapper` смонтирован как
**бэкенд сессионных ключей** (1-click), а вход при этом всё равно идёт через wagmi и расширение.
Задача — сделать Turnkey ещё и дверью входа, не сломав существующую.

## Исходное состояние

| Что | Где | Состояние |
| --- | --- | --- |
| Обёртка Turnkey | `providers/LiqSetup.tsx` | смонтирована при `VITE_TURNKEY_SESSION=true` + `orgId` |
| Конфиг Turnkey | `config/env.ts` (`env.turnkey`) | один флаг `enabled` на всё |
| Коннекторы wagmi | `config/chain.ts` | ровно один — `injected()` |
| Кнопка подключения | `features/wallet/ConnectButton.tsx` | берёт `connectors[0]`, отключение = `disconnect()` |
| Лестница сессии | `features/auth/sessionStage.ts` + `SessionGate.tsx` | ручные CTA: create-account, sign-in |
| Сессионные ключи | `features/session-keys/*` | работают и без Turnkey (кошельковый менеджер SDK) |
| e2e tier1 | `e2e/tier1/*` (29 спек) | входят через поддельный `window.ethereum` |

Существенно, что **SDK 0.47 уже вобрал в себя почти всю машинерию**, которую в `liqu` писали
руками. `@liq/turnkey` экспортирует `turnkeyConnector`, `TURNKEY_CONNECTOR_ID`,
`createEmbeddedProvider`, `createEmbeddedWallet`, `get/setTurnkeyProvider`; `@liq/react` —
`useLiqSignOut`, `useSessionStage`, `resetAuthedQueries`; `@liq/core` — `gasGrantMessage`,
`asGasGrantReason`, `GasGrantReason`, `isInsufficientGas`. Поэтому `turnkeyConnector.ts`,
`embeddedProviderShim.ts`, `turnkeyProviderRegistry.ts` и `disconnectSession.ts` из `liqu`
**не копируются** — они импортируются. Портируется только клей.

## Принятые решения

| Решение | Выбор | Почему |
| --- | --- | --- |
| Судьба injected-входа | **Две двери**: Turnkey и Connect Wallet рядом | tier1 e2e остаются зелёными как есть; форкаемый эталон показывает обе модели identity |
| Методы в модалке | Email OTP + внешний кошелёк, порядок `['email','wallet']` | паритет с `liqu`; всё прочее выключено **явно** |
| Покрытие | Юнит на чистые функции + один лёгкий tier1-спек | в репозитории нет RTL; модалку Turnkey не гоняем |
| Gas grant | **Входит в объём** | свежий встроенный кошелёк пуст, и первый же `createAccount` падает без ETH |
| Выход | Асимметричный: injected → `disconnect()`, turnkey → полный sign-out | см. §4 |

## Не входит в объём

- Фаусет USDC. Внести депозит новому пользователю по-прежнему нужно самому.
- Автопрогон `create-account` и `sign-in`. В `liqu` их гонит лестница; здесь это остаётся
  кнопками в `SessionGate` — они и есть то, что эталонный терминал показывает интегратору.
- Переход `SessionGate` на `useSessionStage()` из SDK вместо локальной копии `sessionStage.ts`.
  Уместная уборка, но она не служит этой задаче.
- Отдельные маршруты `/login` и `/signup`. В терминале нет роутера, вход живёт на ступени
  `disconnected` того же экрана.

## §1. Конфиг и монтирование

`env.turnkey` сегодня мешает две разные вещи в одном флаге. Разделяем:

```ts
const turnkey = {
  orgId, authProxyUrl, authProxyConfigId,       // без изменений
  enabled: VITE_TURNKEY_SESSION === "true",     // бэкенд сессионных ключей
  login:   VITE_TURNKEY_LOGIN   === "true",     // новое: дверь входа
};
```

Плюс `env.turnkeyConfigError: string | null` — непустая строка, когда `login` включён, а
`orgId` или `authProxyConfigId` пуст.

`TurnkeyProviderWrapper` монтируется при `orgId && (enabled || login)`; сегодняшнее условие —
`enabled && orgId`, при нём вход без сессионных ключей был бы невозможен. Обёртке добавляются
`authMethods`, `methodOrder` и `provisionEmbeddedWallet`.

Флаг `VITE_TURNKEY_LOGIN` по умолчанию **выключен**: деплой с `VITE_TURNKEY_SESSION=true` не
получает новую кнопку молча, а tier1 e2e не видят Turnkey вообще.

`turnkeyConfigError` — константа времени сборки, а не рантайм-состояние, и это важно для правила
хуков: `useTurnkey()` бросает вне своего провайдера, значит компонент, который его зовёт, обязан
выйти **до первого хука**, а не по условию внутри. Константа гарантирует, что ветка не меняется
за время монтирования.

`provisionEmbeddedWallet` кладёт `customWallet` и в `createSuborgParams.emailOtpAuth`, и в
`.walletAuth` — суб-организация получает TEE-кошелёк, какой бы дверью Turnkey пользователь ни
вошёл. Поэтому «вошёл почтой» и «вошёл кошельком» — это два способа доказать личность, а не две
личности: подписант в обоих случаях один.

Обёртке нужен `@turnkey/react-wallet-kit/styles.css` — единственный прямой импорт из
`@turnkey/*` в приложении. Без него модалка рендерится без стилей: в dev кит подменяет её
экраном-предупреждением, в prod она просто выглядит сломанной. Импорт стилей ничего не
инстанцирует, поэтому опасности «двух копий SDK Turnkey» (две JS-копии делят ключи
`@turnkey/session/v3` в localStorage и портят сессии друг друга) он не создаёт.

## §2. Коннекторы wagmi и восстановление сессии

`reconnect()` в wagmi 2.22 перебирает **все** коннекторы, отсортированные по свежести, и
подключает первый авторизованный (`@wagmi/core/dist/esm/actions/reconnect.js`). Отсюда ловушка,
которой у одной двери не было:

1. Пользователь вошёл через Turnkey, выбрав внешний кошелёк, — расширение выдало разрешение
   этому origin.
2. Перезагрузка. `recentConnectorId === 'turnkey'`, он идёт первым, но его `getProvider()` в
   этот тик пуст (реестр ещё не заполнен, встроенный кошелёк не разрешён) → `continue`.
3. Следующим идёт `injected`, он авторизован → **wagmi подключает EOA**.
4. Терминал загружается под чужой личностью: `SessionGate` видит кошелёк и предлагает
   create-account и SIWE для адреса, на котором аккаунта нет.

Из-за этого `liqu` выкинул `injected()` совсем. С двумя дверьми закрываем иначе:

- `multiInjectedProviderDiscovery: false`. Иначе wagmi добавляет коннектор на **каждый**
  EIP-6963-кошелёк в браузере, и «первый авторизованный» становится лотереей. Явный
  `injected()` по-прежнему находит `window.ethereum`, поэтому tier1 это не задевает.
- `connectors: [injected(), turnkeyConnector()]` при `env.turnkey.login`, иначе `[injected()]`.
- **Дверь запоминается**: `localStorage['liq-terminal-door']` ∈ `'turnkey' | 'injected'`.
  Пишется при входе, стирается при выходе.
- `WagmiProvider reconnectOnMount={false}`, а восстановление гоняется явно:
  `reconnect({ connectors: [коннектор запомненной двери] })`. Детерминированно и без кадра с
  чужой личностью.
- Владелец двери и восстановления — `IdentityDoorProvider`, и он монтируется **прямо под
  `WagmiProvider`, безусловно**, а не внутри обёртки Turnkey. Это не деталь размещения: обёртка
  Turnkey монтируется только при своём конфиге, и провайдер внутри неё оставил бы деплой с
  выключенным флагом вообще без восстановления сессии — то есть сломал бы
  `15-session-persistence` на пустом месте, ради двери, которой там нет.
- Цена: пока reconnect не отработал, `useAccount()` говорит `disconnected`, и гейт моргнул бы
  экраном входа на каждой перезагрузке. Поэтому `IdentityDoorProvider` отдаёт `booting`, а
  `SessionGate` показывает при нём ступень `loading` — ровно то, что сейчас делает
  `isReconnecting`.
- `ConnectButton` перестаёт брать `connectors[0]` и ищет коннектор по id. Сегодня это работает
  случайно — потому что коннектор ровно один.

Решение «какой коннектор восстанавливать» — чистая функция от запомненной двери и списка
коннекторов; она и тестируется.

## §3. Лестница личности

Три шага, каждый — попытка, а не состояние: `resolve` (встроенный кошелёк) → `connect` (wagmi) →
`gas` (долив ETH). Шаги `account` и `siwe` из лестницы `liqu` сюда не переезжают: их по-прежнему
нажимает пользователь.

```
features/auth/turnkeyLadder.ts            — чистый редьюсер, без React
features/auth/TurnkeyIdentityProvider.tsx — контекст: state, effect, claim, settle, retry
features/auth/EmbeddedWalletRunner.tsx    — createEmbeddedWallet, ничего не рисует
features/auth/GasGrantRunner.tsx          — requestGasGrant, ничего не рисует
```

`TurnkeyIdentityProvider` монтируется **внутри** обёртки Turnkey (ему нужен `useTurnkey()`) и
читает дверь из `IdentityDoorProvider` (§2), который стоит выше и живёт независимо от флага.

**Ключ лестницы** — `session?.organizationId` из `useTurnkey()`, и он `null` пока
`authState !== Authenticated`. Смена ключа — сброс. Этот `null` и есть то, чего нет у россыпи
независимых латчей: без него «вышел и снова вошёл той же почтой в одной вкладке» застревает
навсегда.

**`seq`** монотонно растёт на каждый испущенный эффект и передаётся раннеру. `settle` отклоняет
приземление с чужим `seq`, поэтому ответ отменённой попытки — от личности, из которой уже вышли,
или от попытки, которую перезапустили, — не перезаписывает живой.

**`claim(effect)`** — гарантия «не более одного раза». Она нужна именно здесь, и модульного
промиса для неё мало (есть retry и logout). Цена ошибки высокая: `createEmbeddedWallet` —
это fetch-or-create, два одновременных вызова на суб-организации без кошелька создадут **два**
кошелька, а `SnxAccount.owner` пишется один раз и никогда не переписывается — аккаунт
проигравшего недостижим навсегда.

Разрешённый `LocalAccount` живёт в `ref`, а не в состоянии редьюсера: объект с методами не место
в чистом состоянии, а очистка его внутри редьюсера была бы побочным эффектом в апдейтере,
который StrictMode вызывает дважды.

Шаг `connect` **не имеет исхода**, и это решение, а не пропуск: `useConnect().connect` — это
`mutate()`, а не `mutateAsync()`, его отказ проглатывается внутри react-query, сообщать нечего.
Шаг закрывается наблюдением: `wagmi.isConnected` стал `true`. Следствие — единственный из трёх
шагов, который не умеет заполнить `state.error`: не доехавший connect оставляет попытку в полёте,
и лечится это перезагрузкой.

Мост в wagmi (эффекты внутри провайдера):

- `authState !== Authenticated` → `setTurnkeyProvider(undefined)`, сброс.
- шаг `resolve` приземлился → `createEmbeddedProvider({ account, chain: megaethTestnet, rpcUrl })`
  → `setTurnkeyProvider(provider)` → испускается эффект `connect`.
- эффект `connect` → `reconnect({ connectors: [turnkey] })` **и** `connect({ connector })`, оба
  не дожидаясь друг друга. Это гонка намеренно: `reconnect()` перенимает уже живое соединение,
  `connect()` заводит новое и бросает `ConnectorAlreadyConnectedError`, когда соединение уже
  есть. Бросок безвреден — `mutate()` его проглатывает, — а вдвоём они покрывают и первый
  вход, и живой провайдер после выхода из шапки, ничего не дожидаясь.

## §4. Экран входа и выход

`SessionGate` на ступени `disconnected` рисует `SignInPanel` вместо голого `ConnectButton`:

- `TurnkeyLoginButton` (`data-testid="turnkey-login-button"`) — **отдельный компонент**, а не
  ветка внутри панели: `useTurnkey()` должен вызываться только там, где обёртка смонтирована
  (см. §1 про порядок хуков). Клик зовёт `handleLogin()`; модалка Turnkey и есть весь выбор
  метода.
- `ConnectButton` (`data-testid="connect-wallet-button"`) — существующий, testid не меняется,
  tier1 изменений не замечает.
- `env.turnkeyConfigError` → строка ошибки вместо кнопки Turnkey.

Три состояния ошибки, все портируются из `AuthFormCard`:

1. отказ `handleLogin()` → текст через `humanizeError` из `@liq/core`;
2. `resolve` упал → «не смогли открыть кошелёк» + кнопка повтора (`retry('resolve')`);
3. аутентифицирован, ступень всё ещё `disconnected`, `resolve` в полёте дольше **10 секунд** →
   «кошелёк не отвечает, перезагрузите страницу». Без этого пользователь смотрит на неактивную
   кнопку и не знает, что застрял.

**Выход** — адресная кнопка в шапке, поведение зависит от двери:

- `injected` → как сейчас: `disconnect()`, токен шлюза переживает. Это контракт
  `13-disconnect.spec.ts` («reconnecting after a disconnect returns to the terminal» без второго
  SIWE).
- `turnkey` → `useLiqSignOut()({ logout })`. Порядок внутри хука не косметический: реестр
  провайдеров пустеет первым, потому что `logout()` асинхронен, и в окне между `disconnect()` и
  его разрешением мост видит «аутентифицирован + живой провайдер + отключённый wagmi» и вернул бы
  пользователя внутрь. Затем токен, затем кэш (после токена — иначе перезапрос успел бы уйти со
  старым токеном), затем wagmi и Turnkey.
- В обоих случаях запомненная дверь стирается.

Асимметрия намеренная: без `logout()` кнопка «выйти» под Turnkey не работает вовсе — сессия жива,
и мост немедленно возвращает пользователя внутрь. Симметричный вариант (полный sign-out для обеих
дверей) честнее по UX, но переписывает контракт двух существующих e2e и не служит этой задаче.

## §5. Gas grant

`features/wallet/gasGrant.ts` — порт `requestGasGrant` из `liqu`:
`GET {gateway}/auth/gas-nonce` → подпись → `POST {gateway}/auth/gas` → `GasGrantOutcome`.

Отличие от оригинала: текст подписываемого сообщения и разбор причин берутся из `@liq/core`
(`gasGrantMessage`, `asGasGrantReason`). В `liqu` это локальные копии с комментарием «должно
оставаться байт-в-байт как в шлюзе»; в SDK 0.47 контракт уже общий, и вторая копия здесь была бы
ровно тем дрейфом, от которого тот комментарий предостерегает — расхождение отвечает
`BAD_SIGNATURE` на каждый запрос, и со стороны клиента причину не видно.

Когда: один раз на личность, после `resolve` и до create-account, **только** для двери
`turnkey` — у внешнего кошелька свой газ. Подписывает встроенный аккаунт напрямую
(`account.signMessage`), минуя wagmi: попапа нет, TEE подписывает молча.

Исход **не блокирующий**. `ALREADY_FUNDED`, `RATE_LIMITED`, `UNAVAILABLE` и 404 от деплоя без
этих ручек одинаково означают «идём дальше»; если газа действительно нет, это скажет
`isInsufficientGas` на кнопке создания аккаунта. Различать `HTTP_ERROR` (шлюз ответил статусом
ошибки — вопрос к деплою) и `BAD_RESPONSE` (ответ пришёл с рабочим статусом и не разобрался —
вопрос к этому файлу) стоит сохранить: без проверки `ok` деплой без этих ручек читается как
ошибка разбора.

## Ошибки и краевые случаи

| Случай | Поведение |
| --- | --- |
| `login` включён, `orgId` пуст | `turnkeyConfigError`, обёртка не монтируется, на экране входа — строка ошибки вместо кнопки Turnkey |
| Turnkey аутентифицирован, `resolve` упал | «не смогли открыть кошелёк» + повтор; `claim` не даёт двойного создания |
| `resolve` завис > 10 с | «кошелёк не отвечает, перезагрузите» |
| Приземление от старой личности | отклонено по `seq`; аккаунт из `ref` не всплывает — предикат «держим текущий» один на обоих читателей |
| Шлюз без ручек газа (404) | `HTTP_ERROR` + статус, шаг закрыт, поток идёт дальше |
| Встроенный кошелёк без ETH | `createAccount` падает, текст через `isInsufficientGas` |
| Смена сети под встроенным кошельком | невозможна: провайдер прибит к 6343 и на `wallet_switchEthereumChain` отвечает `SwitchChainError`; ступень `wrong-chain` для этой двери недостижима |
| 1-click поверх Turnkey-входа | без изменений: живая сессия Turnkey заставляет `createTurnkeySessionWallet` пропустить шаги логина и переиспользовать встроенный кошелёк |

## Тесты

Юнит (vitest, только чистые функции — RTL в репозитории нет):

- `turnkeyLadder` — сброс по смене ключа; `claim` пускает эффект ровно раз; `settle` с чужим
  `seq` отклонён; `connect` закрывается наблюдением, а не исходом.
- план восстановления по запомненной двери.
- `gasGrant` на моке `fetch` — успех, 404, ответ с рабочим статусом и невалидным телом, отказ
  подписи (`SIGN_FAILED` не сваливается в `UNREACHABLE`).
- `turnkeyAuthMethods` — все флаги перечислены явно; пропуск ключа отдаёт решение дашборду
  Turnkey.
- `env` — `turnkeyConfigError` появляется и исчезает по конфигу.

e2e tier1 — новый `30-login-doors.spec.ts`: при выключенном флаге на экране входа есть Connect
Wallet и **нет** Turnkey-кнопки, старый путь до терминала цел. Модалку Turnkey не гоняем.

Плюс обновление снапшота `src/__tests__/__snapshots__` — новые `data-testid` обязаны попасть в
инвентарь `testid-inventory.test.ts`.

## Карта файлов

| Файл | Что |
| --- | --- |
| `src/config/env.ts` | + `turnkey.login`, + `turnkeyConfigError` |
| `src/config/chain.ts` | + `turnkeyConnector()`, `multiInjectedProviderDiscovery: false` |
| `src/providers/AppProviders.tsx` | `reconnectOnMount={false}` |
| `src/providers/LiqSetup.tsx` | условие монтирования, `authMethods`, `provisionEmbeddedWallet`, стили кита, монтирование провайдера личности и раннеров |
| `src/features/auth/turnkeyAuthMethods.ts` | **новый** — методы модалки |
| `src/features/auth/identityDoor.ts` | **новый** — чтение/запись двери + чистый план восстановления |
| `src/features/auth/IdentityDoorProvider.tsx` | **новый** — под `WagmiProvider` безусловно: явный reconnect и `booting` |
| `src/features/auth/turnkeyLadder.ts` | **новый** — редьюсер трёх шагов |
| `src/features/auth/TurnkeyIdentityProvider.tsx` | **новый** — контекст и мост в wagmi |
| `src/features/auth/EmbeddedWalletRunner.tsx` | **новый** |
| `src/features/auth/GasGrantRunner.tsx` | **новый** |
| `src/features/auth/SignInPanel.tsx` | **новый** — экран с двумя дверьми |
| `src/features/auth/TurnkeyLoginButton.tsx` | **новый** |
| `src/features/auth/SessionGate.tsx` | ступень `disconnected` → `SignInPanel`; `booting` → `loading` |
| `src/features/wallet/gasGrant.ts` | **новый** — порт `requestGasGrant` |
| `src/features/wallet/ConnectButton.tsx` | выбор коннектора по id; выход, зависящий от двери |
| `.env.example` | `VITE_TURNKEY_LOGIN`, разведение двух флагов в комментариях |
| `README.md` | строка про вход в таблице «Trade lifecycle ↔ SDK calls» |

## Риски

- **Ручки газа на целевом шлюзе.** В `monorepo/apps/order-gateway/src/auth/` исходника
  `gas-grant` нет, но `@liq/core` 0.47 экспортирует его контракт, а `packages/liq-core/tsbuild`
  содержит `auth/gas-grant`. Значит ручки существуют, но на конкретном деплое могут быть не
  подняты. Дизайн это переживает: 404 не блокирует поток.
- **Порядок коннекторов.** Любая правка `getConfig()`, возвращающая `turnkeyConnector` первым,
  тихо переключит `ConnectButton` на Turnkey, если тот снова начнёт брать `connectors[0]`.
  Поэтому выбор по id, а не по индексу.
- **`reconnectOnMount={false}`.** Ошибка в явном восстановлении означает не «неверная личность»,
  а «не восстановились вовсе». Ловится тестом `15-session-persistence`.
