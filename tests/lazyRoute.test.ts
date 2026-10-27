import { afterEach, describe, expect, it, vi } from "vitest";
import { installChunkLoadRecovery, isChunkLoadError, loadRouteModule, recoverFromChunkLoad } from "@/services/lazyRoute";

afterEach(() => vi.unstubAllGlobals());

describe("lazy route loading", () => {
  it("retries one transient chunk failure and resolves the module", async () => {
    const loader = vi
      .fn<() => Promise<{ default: () => null }>>()
      .mockRejectedValueOnce(new Error("transient chunk failure"))
      .mockResolvedValueOnce({ default: () => null });

    const result = await loadRouteModule(loader, 1, 0);

    expect(result.default).toBeTypeOf("function");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("keeps a permanent chunk failure bounded", async () => {
    const error = new Error("permanent chunk failure");
    const loader = vi.fn<() => Promise<{ default: () => null }>>().mockRejectedValue(error);

    await expect(loadRouteModule(loader, 1, 0)).rejects.toBe(error);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("recognizes browser dynamic-import failures but not module errors", () => {
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new Error("Unexpected token"))).toBe(false);
  });

  it("reloads a stale Tauri document once and blocks an immediate loop", () => {
    const reload = vi.fn();
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      location: { hostname: "tauri.localhost", reload },
      sessionStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
    });

    expect(recoverFromChunkLoad(new Error("Failed to fetch dynamically imported module"))).toBe(true);
    expect(recoverFromChunkLoad(new Error("Failed to fetch dynamically imported module"))).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("prevents the Vite preload event and leaves non-Tauri documents alone", () => {
    const remove = vi.fn();
    const add = vi.fn((_name: string, listener: EventListener) => {
      const event = new Event("vite:preloadError", { cancelable: true });
      listener(event);
      expect(event.defaultPrevented).toBe(true);
    });
    vi.stubGlobal("window", { addEventListener: add, removeEventListener: remove, location: { hostname: "localhost" } });

    const dispose = installChunkLoadRecovery();
    expect(dispose).toBeTypeOf("function");
    dispose?.();
    expect(remove).toHaveBeenCalledOnce();
  });
});
