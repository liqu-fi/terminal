import { gasGrantMessage } from "@liq/core";
import { describe, expect, it, vi } from "vitest";

import { requestGasGrant } from "../gasGrant";

const GATEWAY = "https://gw.example.com/v1";
const ADDRESS = "0x1111111111111111111111111111111111111111" as const;
const SIG = "0xdead" as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function call(fetchImpl: typeof fetch, signMessage = vi.fn().mockResolvedValue(SIG)) {
  return requestGasGrant({
    gatewayUrl: GATEWAY,
    address: ADDRESS,
    subOrgId: "sub-1",
    signMessage,
    fetchImpl,
  });
}

describe("requestGasGrant", () => {
  it("подписывает нонс из конверта и возвращает исход шлюза", async () => {
    const signMessage = vi.fn().mockResolvedValue(SIG);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { nonce: "n1" }, meta: {} }))
      .mockResolvedValueOnce(jsonResponse({ data: { funded: true }, meta: {} }));

    await expect(call(fetchImpl as unknown as typeof fetch, signMessage)).resolves.toEqual({
      funded: true,
      reason: undefined,
    });
    expect(signMessage).toHaveBeenCalledWith({ message: gasGrantMessage("n1") });
    expect(fetchImpl.mock.calls[0][0]).toBe(`${GATEWAY}/auth/gas-nonce`);
    expect(fetchImpl.mock.calls[1][0]).toBe(`${GATEWAY}/auth/gas`);
  });

  it("принимает и голое тело без конверта", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ nonce: "n1" }))
      .mockResolvedValueOnce(jsonResponse({ funded: false, reason: "ALREADY_FUNDED" }));

    await expect(call(fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      funded: false,
      reason: "ALREADY_FUNDED",
    });
  });

  it("на деплое без этих ручек отвечает HTTP_ERROR со статусом, а не ошибкой разбора", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    await expect(call(fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      funded: false,
      reason: "HTTP_ERROR",
      status: 404,
    });
  });

  it("429 — это RATE_LIMITED, а не сбой", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
    await expect(call(fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      funded: false,
      reason: "RATE_LIMITED",
      status: 429,
    });
  });

  it("рабочий статус с неразбираемым телом — BAD_RESPONSE", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("не json", { status: 200 }));
    await expect(call(fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      funded: false,
      reason: "BAD_RESPONSE",
    });
  });

  it("оборванная связь — NETWORK", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(call(fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      funded: false,
      reason: "NETWORK",
    });
  });

  it("отказ подписанта не выдаётся за сетевую ошибку", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { nonce: "n1" }, meta: {} }));
    const signMessage = vi.fn().mockRejectedValue(new Error("TEE отказал"));
    await expect(
      call(fetchImpl as unknown as typeof fetch, signMessage),
    ).resolves.toEqual({ funded: false, reason: "SIGN_FAILED" });
  });

  it("неизвестную причину от шлюза приводит к UNKNOWN", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { nonce: "n1" }, meta: {} }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { funded: false, reason: "НОВОЕ" }, meta: {} }),
      );
    await expect(call(fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      funded: false,
      reason: "UNKNOWN",
    });
  });
});
