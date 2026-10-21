/// Permissão `ui`: o plugin pode mexer em qualquer parte da tela. Tudo que ele monta ou injeta
/// é desfeito quando o plugin é desligado ou o host é recarregado.

/// Pontos fixos da tela onde um plugin pode montar um bloco. Cada um é um `data-plugin-slot` no componente.
export const UI_SLOTS = ["chat", "composer", "sidebar"] as const;
export type UiSlot = (typeof UI_SLOTS)[number];

export interface PluginUiApi {
  /** Acesso ao documento inteiro: o plugin pode ler e mudar qualquer parte da tela. */
  root(): Document;
  /** Injeta CSS. A folha sai quando o plugin é desligado. */
  addStyle(css: string): void;
  /** Monta um bloco no ponto indicado, quando o ponto existir na tela. O que `render` devolver é chamado ao desligar. */
  mount(slot: UiSlot, render: (el: HTMLElement) => void | (() => void)): void;
}

interface Mount {
  pluginId: string;
  slot: UiSlot;
  render: (el: HTMLElement) => void | (() => void);
  el?: HTMLElement;
  cleanup?: () => void;
}

/// Guarda o que os plugins montaram e aplica os blocos quando o ponto aparece na tela.
export class PluginUi {
  private styles: { pluginId: string; el: HTMLStyleElement }[] = [];
  private mounts: Mount[] = [];
  private observer?: MutationObserver;

  api(pluginId: string): PluginUiApi {
    return {
      root: () => document,
      addStyle: (css) => {
        const el = document.createElement("style");
        el.dataset.plugin = pluginId;
        el.textContent = css;
        document.head.appendChild(el);
        this.styles.push({ pluginId, el });
      },
      mount: (slot, render) => {
        this.mounts.push({ pluginId, slot, render });
        this.observe();
        this.attach();
      },
    };
  }

  /// Monta os blocos cujo ponto já está na tela. Chamado quando a tela muda.
  attach() {
    for (const mount of this.mounts) {
      if (mount.el?.isConnected) continue;
      // O ponto sumiu da tela (a barra foi desenhada de novo): o bloco antigo sai e monta no ponto novo.
      if (mount.el) {
        mount.el.remove();
        mount.el = undefined;
      }
      const slot = document.querySelector<HTMLElement>(`[data-plugin-slot="${mount.slot}"]`);
      if (!slot) continue;
      // Um bloco por plugin em cada ponto: com várias conversas abertas, a primeira monta e as outras esperam.
      if (Array.from(slot.children).some((child) => (child as HTMLElement).dataset.plugin === mount.pluginId)) continue;
      const el = document.createElement("div");
      el.dataset.plugin = mount.pluginId;
      slot.appendChild(el);
      mount.el = el;
      try {
        mount.cleanup = mount.render(el) ?? undefined;
      } catch (e) {
        el.remove();
        mount.el = undefined;
        console.error(`plugin ${mount.pluginId}: falha ao montar em ${mount.slot}`, e);
      }
    }
  }

  /// Desfaz tudo que os plugins montaram ou injetaram. Com `pluginId`, só o desse plugin.
  clear(pluginId?: string) {
    const keep = (owner: string) => pluginId !== undefined && owner !== pluginId;
    for (const style of this.styles) if (!keep(style.pluginId)) style.el.remove();
    this.styles = this.styles.filter((s) => keep(s.pluginId));
    for (const mount of this.mounts) {
      if (keep(mount.pluginId)) continue;
      try {
        mount.cleanup?.();
      } catch (e) {
        console.error(`plugin ${mount.pluginId}: erro ao desmontar`, e);
      }
      mount.el?.remove();
    }
    this.mounts = this.mounts.filter((m) => keep(m.pluginId));
    if (this.mounts.length === 0) this.observer?.disconnect();
  }

  private observe() {
    if (this.observer || typeof MutationObserver === "undefined") return;
    this.observer = new MutationObserver(() => this.attach());
    this.observer.observe(document.body, { childList: true, subtree: true });
  }
}
