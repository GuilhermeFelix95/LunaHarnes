import { afterEach, describe, expect, it } from "vitest";
import { CACHE_LONG_KEY, longCacheEnabled, setLongCache } from "./cacheSettings";

describe("cache de 1 h", () => {
  afterEach(() => localStorage.removeItem(CACHE_LONG_KEY));

  it("vem desligado por padrão", () => {
    expect(longCacheEnabled()).toBe(false);
  });

  it("liga e desliga, e a escolha fica salva", () => {
    setLongCache(true);
    expect(longCacheEnabled()).toBe(true);
    setLongCache(false);
    expect(longCacheEnabled()).toBe(false);
  });
});
