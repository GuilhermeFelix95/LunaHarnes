import { beforeEach, describe, expect, it, vi } from "vitest";
// O mesmo script que o app injeta na webview do navegador (ver browser_actions.rs).
import pageSource from "../../src-tauri/src/browser_scripts/page.js?raw";

type Page = {
  snapshot(): { url: string; title: string; blocker: string | null; items: Array<{ ref: number; role: string; name: string; dialog: string | null }> };
  act(ref: number, action: string, value?: string): { ok: boolean; error?: string };
  key(name: string, ref?: number): { ok: boolean };
  inspect(ref: number): { ok: boolean; name?: string; role?: string; error?: string };
  hasText(text: string): boolean;
  links(): Array<{ text: string; href: string }>;
  blocker(): string | null;
};

/// Carrega o script como ele roda na página: um objeto `__luna` com os métodos.
function load(): Page {
  return new Function(`${pageSource}\nreturn __luna;`)() as Page;
}

/// jsdom não tem layout: dá um tamanho a todo elemento para que contem como visível.
function fakeLayout() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ x: 10, y: 10, width: 100, height: 20, top: 10, left: 10, right: 110, bottom: 30, toJSON() {} }) as DOMRect,
  );
  // jsdom não rola a tela: o método existe nos navegadores reais.
  Element.prototype.scrollIntoView = vi.fn();
}

function youtubeModal() {
  document.body.innerHTML = `
    <main><button id="inscrever">Inscrever-se</button></main>
    <div role="dialog" aria-modal="true">
      <h2>Descrição</h2>
      <button id="fechar" aria-label="Fechar"><svg></svg></button>
      <p>Falo sobre engenharia de software.</p>
    </div>`;
  const dialog = document.querySelector("[role=dialog]") as HTMLElement;
  document.getElementById("fechar")!.addEventListener("click", () => dialog.remove());
}

describe("script da página: o agente vê e age sobre os controles", () => {
  beforeEach(() => {
    fakeLayout();
    document.body.innerHTML = "";
  });

  it("lista o botão Fechar do modal com o rótulo e o diálogo onde ele está", () => {
    youtubeModal();
    const snap = load().snapshot();
    const close = snap.items.find((item) => item.name === "Fechar");

    expect(close).toBeDefined();
    expect(close!.role).toBe("button");
    expect(close!.dialog).toBe("Descrição");
  });

  it("fecha o modal pela referência, sem seletor CSS", () => {
    youtubeModal();
    const page = load();
    const close = page.snapshot().items.find((item) => item.name === "Fechar")!;

    expect(page.act(close.ref, "click")).toEqual({ ok: true });
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  it("uma referência que não existe mais devolve erro pedindo um novo snapshot", () => {
    youtubeModal();
    const page = load();
    page.snapshot();
    const result = page.act(999, "click");

    expect(result.ok).toBe(false);
    expect(result.error).toContain("novo browser_snapshot");
  });

  it("Esc chega ao documento, para modais que fecham com a tecla", () => {
    youtubeModal();
    const onEsc = vi.fn();
    document.addEventListener("keydown", (event) => event.key === "Escape" && onEsc());
    load().key("Escape");

    expect(onEsc).toHaveBeenCalledTimes(1);
  });

  it("digitar num campo preenche o valor e dispara o evento de mudança", () => {
    document.body.innerHTML = `<label>Nome <input id="nome" placeholder="Seu nome"></label>`;
    const page = load();
    const field = page.snapshot().items.find((item) => item.role === "textbox")!;
    expect(page.act(field.ref, "type", "Ana").ok).toBe(true);
    expect((document.getElementById("nome") as HTMLInputElement).value).toBe("Ana");
  });

  it("não devolve o valor de campo de senha", () => {
    document.body.innerHTML = `<input type="password" id="senha" aria-label="Senha" value="segredo">`;
    const page = load();
    const field = page.snapshot().items[0];

    expect(field.name).toBe("Senha");
    expect(JSON.stringify(page.snapshot())).not.toContain("segredo");
  });

  it("reconhece página de login, CAPTCHA e confirmação de conta", () => {
    document.body.innerHTML = `<form><input type="password" aria-label="Senha"></form>`;
    expect(load().blocker()).toBe("login");

    document.body.innerHTML = `<p>Confirme que você é humano para continuar</p>`;
    expect(load().blocker()).toBe("captcha");

    document.body.innerHTML = `<p>Digite o código de verificação enviado ao seu e-mail</p>`;
    expect(load().blocker()).toBe("confirmacao");

    document.body.innerHTML = `<p>Resultados da pesquisa</p>`;
    expect(load().blocker()).toBeNull();
  });

  it("lista os links externos de uma página de busca, sem os do próprio site", () => {
    document.body.innerHTML = `
      <a href="https://github.com/x/y">Repositório Y</a>
      <a href="https://exemplo.com/artigo">Artigo</a>
      <a href="${location.href}interno">Interno</a>`;
    const links = load().links();

    expect(links.map((link) => link.text)).toEqual(["Repositório Y", "Artigo"]);
  });
});
