import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const hooks = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  refs: [] as Array<{ current: unknown }>,
  cursor: 0,
  setResult: vi.fn(),
}));
vi.mock("react", () => ({
  useState: (initial: unknown) => [initial, hooks.setResult],
  useCallback: (callback: unknown) => callback,
  useRef: (initial: unknown) => {
    const index = hooks.cursor++;
    return hooks.refs[index] ?? (hooks.refs[index] = { current: initial });
  },
  useEffect: (effect: () => void | (() => void)) => {
    hooks.effects.push(effect);
  },
}));
import { useVisiblePolling } from "@/lib/hooks/use-visible-polling";
function PollingProbe({ url }: { url: string }) {
  return useVisiblePolling<{ value: string }>(url);
}
const fetcher = vi.fn<typeof fetch>();
let visibility = "visible";
let page: EventTarget;
let browser: EventTarget;
let cleanup: void | (() => void);
function mount(url: string) {
  hooks.cursor = 0;
  PollingProbe({ url });
  cleanup = hooks.effects.pop()!();
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  hooks.refs = [];
  hooks.effects = [];
  hooks.cursor = 0;
  visibility = "visible";
  page = new EventTarget();
  Object.defineProperty(page, "visibilityState", { get: () => visibility });
  browser = Object.assign(new EventTarget(), {
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  });
  vi.stubGlobal("document", page);
  vi.stubGlobal("window", browser);
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockImplementation(async () => Response.json({ value: "fresh" }));
});
afterEach(() => {
  if (typeof cleanup === "function") cleanup();
  cleanup = undefined;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("Visible polling", () => {
  it("does not fetch in a hidden tab and refreshes immediately on visibility or focus", async () => {
    visibility = "hidden";
    mount("/queue/a");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetcher).not.toHaveBeenCalled();
    visibility = "visible";
    page.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    browser.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(2);
    visibility = "hidden";
    page.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("aborts the old URL and ignores a late response even if fetch ignores abort", async () => {
    let resolveOld!: (response: Response) => void;
    fetcher.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveOld = resolve;
        })
    );
    mount("/queue/old");
    await vi.advanceTimersByTimeAsync(0);
    const signal = fetcher.mock.calls[0][1]?.signal;
    if (typeof cleanup === "function") cleanup();
    mount("/queue/new");
    await vi.advanceTimersByTimeAsync(0);
    expect(signal?.aborted).toBe(true);
    resolveOld(Response.json({ value: "stale" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(hooks.setResult).toHaveBeenLastCalledWith(
      expect.objectContaining({ url: "/queue/new", data: { value: "fresh" } })
    );
    expect(
      hooks.setResult.mock.calls.some(([value]) => value?.data?.value === "stale")
    ).toBe(false);
  });
});
