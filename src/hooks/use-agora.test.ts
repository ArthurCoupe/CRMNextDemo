import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAgora } from "./use-agora";

afterEach(() => {
  vi.useRealTimers();
});

describe("useAgora", () => {
  it("renova o instante a cada 60 s, não antes, e para ao desmontar", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T13:00:00Z"));
    const { result, unmount } = renderHook(() => useAgora());
    expect(result.current.toISOString()).toBe("2026-01-05T13:00:00.000Z");

    act(() => {
      vi.advanceTimersByTime(59_999);
    });
    expect(result.current.toISOString()).toBe("2026-01-05T13:00:00.000Z");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.toISOString()).toBe("2026-01-05T13:01:00.000Z");

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
