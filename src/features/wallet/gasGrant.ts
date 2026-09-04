import { asGasGrantReason, gasGrantMessage, type GasGrantReason } from "@liq/core";

/**
 * Причины, которых нет в перечислении SDK.
 *
 * @remarks
 * SDK знает пять отказов самого шлюза плюс `USER_REJECTED`, `NETWORK` и
 * `UNKNOWN`. Три причины ниже он не покрывает, и сворачивать их в `UNKNOWN`
 * значит терять того, к кому вопрос:
 *
 * - `HTTP_ERROR` — шлюз ответил кодом ошибки, то есть до логики гранта дело не
 *   дошло: вопрос к деплою (404 — ручек нет, 500 — шлюз упал, 400 — тело собрано
 *   не так). Без проверки `ok` деплой без этих ручек читался бы как ошибка
 *   разбора, то есть как ошибка вот этого файла.
 * - `BAD_RESPONSE` — ответ пришёл с рабочим статусом и не разобрался: вопрос как
 *   раз к этому файлу.
 * - `SIGN_FAILED` — подписант (анклав) отказался подписать нонс. Это не
 *   `USER_REJECTED`: у встроенного кошелька нет пользователя, который мог бы
 *   отказаться, и указывать отлаживающему на диалог кошелька было бы ложью.
 */
type LocalGasGrantReason = "HTTP_ERROR" | "BAD_RESPONSE" | "SIGN_FAILED";

/**
 * @remarks
 * `status` несётся только для отказного HTTP-статуса, где одной причины мало,
 * чтобы понять, что делать. На остальных исходах статуса просто нет.
 */
export type GasGrantOutcome = {
  funded: boolean;
  reason?: GasGrantReason | LocalGasGrantReason;
  status?: number;
};

/**
 * Полезная нагрузка внутри конверта `{ data, meta }`.
 *
 * @remarks
 * Глобальный `ResponseInterceptor` шлюза заворачивает каждый JSON-ответ (живая
 * проверка staging 2026-09-04: `{"data":{"nonce":"…"},"meta":{…}}`), поэтому
 * проверки формы обязаны идти по `data`. Голое тело пропускается как есть, а не
 * отвергается: этот же код обслуживает локальные и мок-шлюзы без конверта.
 */
function envelopePayload(body: unknown): unknown {
  if (
    typeof body === "object" &&
    body !== null &&
    "data" in body &&
    (body as { data?: unknown }).data !== undefined
  ) {
    return (body as { data: unknown }).data;
  }
  return body;
}

/**
 * Что означает не-2xx.
 *
 * @remarks
 * Обычный отказ шлюз выражает исходом с кодом 2xx, поэтому отказной статус
 * значит, что до логики гранта не дошли. Исключение — глобальный
 * `ThrottlerGuard`, который умеет говорить только статусами: 429 — это тот же
 * отказ, который фаусет называет `RATE_LIMITED`, и показывать его как сбой было
 * бы неправдой о том, чья это проблема.
 */
function statusRefusal(status: number): GasGrantOutcome {
  return {
    funded: false,
    reason: status === 429 ? "RATE_LIMITED" : "HTTP_ERROR",
    status,
  };
}

function isNonceBody(body: unknown): body is { nonce: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { nonce?: unknown }).nonce === "string"
  );
}

function isGasGrantBody(
  body: unknown,
): body is { funded: boolean; reason?: unknown } {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { funded?: unknown }).funded === "boolean"
  );
}

/**
 * Просит шлюз налить газа свежему встроенному кошельку.
 *
 * @remarks
 * Идёт до создания аккаунта, потому что это первая ончейн-запись, и ей нужен
 * газ, которого у нового адреса нет. Аутентификация здесь — подпись, а не токен:
 * токена ещё не существует, шлюз привязывает его к accountId, которого тоже нет.
 *
 * Никогда не бросает: «не налили» — обычный исход (вернувшемуся пользователю уже
 * наливали, часть деплоев живёт с выключенным фаусетом), и онбординг обязан
 * продолжаться. Каждый шаг падает в ту причину, которая его объясняет, а не в
 * общий catch: нерасшифрованный ответ, отказ подписи и оборванная связь — три
 * разные проблемы для того, кто разбирает застрявший онбординг.
 */
export async function requestGasGrant(input: {
  gatewayUrl: string;
  address: `0x${string}`;
  subOrgId: string;
  signMessage: (args: { message: string }) => Promise<`0x${string}`>;
  fetchImpl?: typeof fetch;
}): Promise<GasGrantOutcome> {
  const doFetch = input.fetchImpl ?? fetch;

  let nonceRes: Response;
  try {
    nonceRes = await doFetch(`${input.gatewayUrl}/auth/gas-nonce`);
  } catch {
    return { funded: false, reason: "NETWORK" };
  }
  if (!nonceRes.ok) return statusRefusal(nonceRes.status);

  let nonceBody: unknown;
  try {
    nonceBody = envelopePayload(await nonceRes.json());
  } catch {
    return { funded: false, reason: "BAD_RESPONSE" };
  }
  if (!isNonceBody(nonceBody)) return { funded: false, reason: "BAD_RESPONSE" };
  const { nonce } = nonceBody;

  let signature: `0x${string}`;
  try {
    // Текст берётся из @liq/core, а не переписывается здесь: шлюз сверяет
    // подпись через `verifyMessage`, поэтому лишний пробел или иной перенос
    // строки даёт BAD_SIGNATURE — отказ, со стороны клиента неотличимый от
    // чужого нонса. Вторая копия этой строки и была тем самым тихим швом.
    signature = await input.signMessage({ message: gasGrantMessage(nonce) });
  } catch {
    return { funded: false, reason: "SIGN_FAILED" };
  }

  let res: Response;
  try {
    res = await doFetch(`${input.gatewayUrl}/auth/gas`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        address: input.address,
        nonce,
        signature,
        subOrgId: input.subOrgId,
      }),
    });
  } catch {
    return { funded: false, reason: "NETWORK" };
  }
  if (!res.ok) return statusRefusal(res.status);

  let body: unknown;
  try {
    body = envelopePayload(await res.json());
  } catch {
    return { funded: false, reason: "BAD_RESPONSE" };
  }
  if (!isGasGrantBody(body)) return { funded: false, reason: "BAD_RESPONSE" };
  return {
    funded: body.funded,
    reason: body.reason === undefined ? undefined : asGasGrantReason(body.reason),
  };
}
