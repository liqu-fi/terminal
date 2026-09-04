// src/features/auth/__tests__/turnkeyLadder.test.ts
import { describe, expect, it } from "vitest";

import {
  embeddedWalletView,
  heldAccountIsCurrent,
  holdAccount,
  initialLadderState,
  ladderNext,
  ladderRetry,
  ladderSettle,
  type LadderCtx,
  type LadderState,
} from "../turnkeyLadder";

const ADDR = "0x2222222222222222222222222222222222222222" as const;

function ctx(over: Partial<LadderCtx> = {}): LadderCtx {
  return {
    key: "sub-1",
    stage: "disconnected",
    wagmi: {
      isConnected: false,
      isConnecting: false,
      isReconnecting: false,
      address: null,
    },
    tokenAddress: null,
    silentSigner: false,
    ...over,
  };
}

/** Прогоняет наблюдение и отдаёт пару «состояние + эффект». */
function step(state: LadderState, c: LadderCtx) {
  return ladderNext(state, c);
}

describe("ladderNext", () => {
  it("без аутентификации ничего не делает", () => {
    const r = step(initialLadderState, ctx({ key: null }));
    expect(r.effect.kind).toBe("none");
  });

  it("смена личности сбрасывает лестницу", () => {
    const first = step(initialLadderState, ctx()).state;
    const r = step(first, ctx({ key: "sub-2" }));
    expect(r.effect.kind).toBe("reset");
    expect(r.state.key).toBe("sub-2");
    expect(r.state.attempts).toEqual({});
  });

  it("выход — это тоже смена личности, на null", () => {
    const first = step(initialLadderState, ctx()).state;
    const r = step(first, ctx({ key: null }));
    expect(r.effect.kind).toBe("reset");
    expect(r.state.key).toBeNull();
  });

  it("после смены ключа seq не откатывается", () => {
    const first = step(initialLadderState, ctx()).state;
    const r = step(first, ctx({ key: "sub-2" }));
    expect(r.state.seq).toBeGreaterThan(first.seq);
  });

  it("токен от другого кошелька сбрасывает лестницу", () => {
    const first = step(initialLadderState, ctx()).state;
    const r = step(
      first,
      ctx({
        wagmi: { ...ctx().wagmi, address: "0xaaa" },
        tokenAddress: "0xbbb",
      }),
    );
    expect(r.effect.kind).toBe("reset");
  });

  it("восстановленный токен без подключённого кошелька — не рассинхрон", () => {
    const first = step(initialLadderState, ctx()).state;
    const r = step(first, ctx({ tokenAddress: "0xbbb" }));
    expect(r.effect.kind).not.toBe("reset");
  });

  it("первым делом разрешает встроенный кошелёк", () => {
    const r = step(initialLadderState, ctx());
    expect(r.effect).toEqual({ kind: "resolve-signer", seq: 1 });
    expect(r.state.attempts.resolve).toEqual({ status: "inflight", seq: 1 });
  });

  it("не запускает разрешение второй раз, пока первое в полёте", () => {
    const first = step(initialLadderState, ctx()).state;
    expect(step(first, ctx()).effect.kind).toBe("none");
  });

  it("упавшее разрешение само не перезапускается", () => {
    const started = step(initialLadderState, ctx()).state;
    const failed = ladderSettle(started, {
      step: "resolve",
      ok: false,
      seq: 1,
      error: new Error("нет сессии"),
    });
    expect(step(failed, ctx()).effect.kind).toBe("none");
  });

  it("retry переоткрывает упавший шаг", () => {
    const started = step(initialLadderState, ctx()).state;
    const failed = ladderSettle(started, {
      step: "resolve",
      ok: false,
      seq: 1,
      error: new Error("нет сессии"),
    });
    const rearmed = ladderRetry(failed, "resolve");
    expect(step(rearmed, ctx()).effect.kind).toBe("resolve-signer");
  });

  it("приземление с чужим seq игнорируется", () => {
    const started = step(initialLadderState, ctx()).state;
    const stale = ladderSettle(started, {
      step: "resolve",
      ok: true,
      seq: 99,
      address: ADDR,
    });
    expect(stale).toBe(started);
  });

  it("после разрешения отдаёт подписанта в wagmi", () => {
    const started = step(initialLadderState, ctx()).state;
    const resolved = ladderSettle(started, {
      step: "resolve",
      ok: true,
      seq: 1,
      address: ADDR,
    });
    const r = step(resolved, ctx());
    expect(r.effect.kind).toBe("connect");
  });

  it("не долбит connect, пока wagmi подключается", () => {
    const started = step(initialLadderState, ctx()).state;
    const resolved = ladderSettle(started, {
      step: "resolve", ok: true, seq: 1, address: ADDR,
    });
    const c = ctx({ wagmi: { ...ctx().wagmi, isConnecting: true } });
    expect(step(resolved, c).effect.kind).toBe("none");
  });

  it("живое подключение снимает отметку connect, оборвавшееся — пробует снова", () => {
    const started = step(initialLadderState, ctx()).state;
    const resolved = ladderSettle(started, {
      step: "resolve", ok: true, seq: 1, address: ADDR,
    });
    const connecting = step(resolved, ctx()).state;
    const connected = step(
      connecting,
      ctx({ wagmi: { ...ctx().wagmi, isConnected: true } }),
    ).state;
    expect(connected.attempts.connect).toBeUndefined();
    expect(step(connected, ctx()).effect.kind).toBe("connect");
  });

  it("газ просит один раз, перед созданием аккаунта", () => {
    const started = step(initialLadderState, ctx()).state;
    const resolved = ladderSettle(started, {
      step: "resolve", ok: true, seq: 1, address: ADDR,
    });
    const c = ctx({
      stage: "no-account",
      silentSigner: true,
      wagmi: { ...ctx().wagmi, isConnected: true, address: ADDR.toLowerCase() },
    });
    const r = step(resolved, c);
    expect(r.effect).toMatchObject({ kind: "gas", address: ADDR });
    expect(step(r.state, c).effect.kind).toBe("none");
  });

  it("отказ в газе закрывает шаг как «спросили», а не как провал", () => {
    const started = step(initialLadderState, ctx()).state;
    const resolved = ladderSettle(started, {
      step: "resolve", ok: true, seq: 1, address: ADDR,
    });
    const c = ctx({
      stage: "no-account",
      silentSigner: true,
      wagmi: { ...ctx().wagmi, isConnected: true, address: ADDR.toLowerCase() },
    });
    const asked = step(resolved, c);
    const seq = asked.effect.kind === "gas" ? asked.effect.seq : -1;
    const settled = ladderSettle(asked.state, {
      step: "gas",
      seq,
      outcome: { funded: false, reason: "ALREADY_FUNDED" },
    });
    expect(settled.attempts.gas?.status).toBe("ok");
    expect(settled.gasOutcome).toEqual({ funded: false, reason: "ALREADY_FUNDED" });
  });
});

describe("embeddedWalletView", () => {
  it("проецирует шаг разрешения на то, что читает экран", () => {
    expect(embeddedWalletView(initialLadderState)).toEqual({ kind: "idle" });
    const started = ladderNext(initialLadderState, ctx()).state;
    expect(embeddedWalletView(started)).toEqual({ kind: "resolving" });
    const ready = ladderSettle(started, {
      step: "resolve", ok: true, seq: 1, address: ADDR,
    });
    expect(embeddedWalletView(ready)).toEqual({ kind: "ready", address: ADDR });
  });
});

describe("удержание аккаунта", () => {
  it("держит только приземление текущей попытки", () => {
    const started = ladderNext(initialLadderState, ctx()).state;
    const ready = ladderSettle(started, {
      step: "resolve", ok: true, seq: 1, address: ADDR,
    });
    expect(heldAccountIsCurrent(ready, 1)).toBe(true);
    expect(heldAccountIsCurrent(ready, 0)).toBe(false);
  });

  it("позднее приземление отменённой попытки не затирает живое", () => {
    expect(holdAccount({ seq: 5, account: "живой" }, 3, "мёртвый")).toEqual({
      seq: 5,
      account: "живой",
    });
    expect(holdAccount({ seq: 3, account: "старый" }, 5, "новый")).toEqual({
      seq: 5,
      account: "новый",
    });
  });
});
