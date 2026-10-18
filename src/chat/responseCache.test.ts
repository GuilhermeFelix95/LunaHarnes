import { describe, expect, it } from "vitest";
import { ResponseCache } from "./responseCache";

describe("ResponseCache", () => {
  it("conta uma consulta sem acerto quando o cache está ligado", () => {
    const cache = new ResponseCache();
    cache.setEnabled(true);

    expect(cache.get("pergunta")).toBeUndefined();

    expect(cache.stats()).toEqual({ hits: 0, lookups: 1, stored: 0 });
  });

  it("conta acerto e consulta quando a resposta já está guardada", () => {
    const cache = new ResponseCache();
    cache.setEnabled(true);
    cache.set("pergunta", "resposta");

    expect(cache.get("pergunta")).toBe("resposta");

    expect(cache.stats()).toEqual({ hits: 1, lookups: 1, stored: 1 });
  });

  it("não conta consultas com o cache desligado", () => {
    const cache = new ResponseCache();

    cache.get("pergunta");

    expect(cache.stats()).toEqual({ hits: 0, lookups: 0, stored: 0 });
  });

  it("mantém os contadores ao esvaziar as respostas", () => {
    const cache = new ResponseCache();
    cache.setEnabled(true);
    cache.set("pergunta", "resposta");
    cache.get("pergunta");

    cache.clear();

    expect(cache.stats()).toEqual({ hits: 1, lookups: 1, stored: 0 });
  });
});
