// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTerminalUiStore } from "../useTerminalUiStore";

describe("стор состояния экрана", () => {
  beforeEach(() => {
    useTerminalUiStore.getState().reset();
    localStorage.clear();
  });

  it("начинается с развёрнутого чарта и без фуллскрина", () => {
    expect(useTerminalUiStore.getState().chartCollapsed).toBe(false);
    expect(useTerminalUiStore.getState().bottomFullscreen).toBe(false);
  });

  it("переключает свёртку чарта", () => {
    useTerminalUiStore.getState().toggleChart();
    expect(useTerminalUiStore.getState().chartCollapsed).toBe(true);
    useTerminalUiStore.getState().toggleChart();
    expect(useTerminalUiStore.getState().chartCollapsed).toBe(false);
  });

  it("переключает фуллскрин нижней панели независимо от чарта", () => {
    useTerminalUiStore.getState().toggleBottomFullscreen();
    expect(useTerminalUiStore.getState().bottomFullscreen).toBe(true);
    expect(useTerminalUiStore.getState().chartCollapsed).toBe(false);
  });

  it("персистит свёртку чарта в localStorage под ключом terminal-ui", async () => {
    useTerminalUiStore.getState().toggleChart();

    await vi.waitFor(() => {
      const raw = localStorage.getItem("terminal-ui");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw as string) as {
        state: { chartCollapsed: boolean };
      };
      expect(parsed.state.chartCollapsed).toBe(true);
    });
  });
});
