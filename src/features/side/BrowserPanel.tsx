import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Globe, Plus, RotateCw, Star, X } from "lucide-react";
import {
  browserBookmarkAdd,
  browserBookmarkRemove,
  browserBookmarks,
  browserCloseTab,
  browserHistory,
  browserNavigate,
  browserNewTab,
  browserReload,
  browserSetBounds,
  browserShow,
  browserState,
  browserSwitchTab,
  onBrowserNavigated,
  onBrowserOpened,
  type BrowserBookmark,
  type BrowserBounds,
  type BrowserTab,
} from "../../api";
import { EmptyState } from "../../ui/EmptyState";
import { t } from "../../i18n";

interface BrowserPanelProps {
  /** Aba do navegador à mostra. Fora dela, a página sai de cena para não cobrir o chat. */
  active: boolean;
  /** Endereço pedido de fora (Ctrl+clique num link do chat): abre numa aba nova. */
  openRequest?: { url: string } | null;
}

/// Limite de abas, igual ao do Rust (que é quem recusa de fato). Aqui só desabilita o botão de nova aba.
const MAX_TABS = 6;

/// Área onde a página aparece: a webview da aba ativa fica exatamente sobre este elemento.
function measure(area: HTMLElement): BrowserBounds {
  const rect = area.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

/// Nome curto de uma aba: o endereço sem o esquema, ou "Nova aba" enquanto estiver em branco.
function tabLabel(tab: BrowserTab): string {
  if (!tab.url || tab.url === "about:blank") return t("browser.blankTab");
  try {
    return new URL(tab.url).hostname || tab.url;
  } catch {
    return tab.url;
  }
}

/// Navegador embutido, com várias abas. Cada aba é uma webview filha da janela, então não usa iframe e funciona com sites que bloqueiam iframes.
export function BrowserPanel({ active, openRequest }: BrowserPanelProps) {
  const area = useRef<HTMLDivElement>(null);
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);

  const currentTab = tabs.find((tab) => tab.id === current) ?? null;
  const currentBookmark = currentTab ? bookmarks.find((b) => b.url === currentTab.url) : undefined;

  // Ao montar, lê as abas que já estão abertas (elas sobrevivem a fechar o painel) e os favoritos.
  useEffect(() => {
    browserState().then(
      (state) => {
        setTabs(state.tabs);
        setCurrent(state.active);
        setAddress(state.tabs.find((tab) => tab.id === state.active)?.url ?? "");
      },
      () => {},
    );
    browserBookmarks().then(setBookmarks, () => {});
  }, []);

  // O agente abriu uma página: o painel acompanha as abas e mostra o endereço, mesmo com a aba fechada.
  useEffect(() => {
    const unlisten = onBrowserOpened((url) => {
      browserState().then((state) => {
        setTabs(state.tabs);
        setCurrent(state.active);
        setAddress(url);
      }, () => {});
    });
    return () => {
      unlisten.then((stop) => stop()).catch(() => {});
    };
  }, []);

  // A página mudou sozinha (clique num link): relê as abas, para o endereço e a estrela de favorito acompanharem.
  useEffect(() => {
    const unlisten = onBrowserNavigated(() => {
      browserState().then((state) => {
        setTabs(state.tabs);
        setCurrent(state.active);
        setAddress(state.tabs.find((tab) => tab.id === state.active)?.url ?? "");
      }, () => {});
    });
    return () => {
      unlisten.then((stop) => stop()).catch(() => {});
    };
  }, []);

  // Link pedido de fora (Ctrl+clique no chat): cada pedido novo abre uma aba com o endereço.
  useEffect(() => {
    if (openRequest) void openTab(openRequest.url);
  }, [openRequest]);

  // Mostra a página da aba ativa quando a aba do painel está à vista e esconde quando sai.
  useEffect(() => {
    if (!active) {
      browserShow(false).catch(() => {});
      return;
    }
    browserShow(true).catch(() => {});
  }, [active, current]);

  // Acompanha a área com a webview: muda com o tamanho do painel e da janela.
  useEffect(() => {
    const el = area.current;
    if (current === null || !active || !el) return;
    function sync() {
      if (el) browserSetBounds(measure(el)).catch((e) => setError(String(e)));
    }
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [current, active]);

  function bounds(): BrowserBounds | undefined {
    return area.current ? measure(area.current) : undefined;
  }

  /// Abre uma aba nova: em branco, ou já com o endereço digitado.
  async function openTab(url: string | null) {
    const el = area.current;
    if (!el) return;
    try {
      const id = await browserNewTab(url, measure(el));
      setTabs((list) => [...list, { id, url: url ?? "" }]);
      setCurrent(id);
      setAddress(url ?? "");
    } catch (err) {
      setError(String(err));
    }
  }

  async function go(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const target = address.trim();
    if (!target) return;
    setError(undefined);
    if (current === null) {
      await openTab(target);
      return;
    }
    try {
      const url = await browserNavigate(target);
      setAddress(url);
      setTabs((list) => list.map((tab) => (tab.id === current ? { ...tab, url } : tab)));
    } catch (err) {
      setError(String(err));
    }
  }

  async function switchTo(tab: BrowserTab) {
    const box = bounds();
    if (!box) return;
    setError(undefined);
    try {
      await browserSwitchTab(tab.id, box);
      setCurrent(tab.id);
      setAddress(tab.url);
    } catch (err) {
      setError(String(err));
    }
  }

  async function closeTab(id: number) {
    setError(undefined);
    try {
      const next = await browserCloseTab(id);
      const remaining = tabs.filter((tab) => tab.id !== id);
      setTabs(remaining);
      setCurrent(next);
      setAddress(remaining.find((tab) => tab.id === next)?.url ?? "");
    } catch (err) {
      setError(String(err));
    }
  }

  /// Favoritar guarda o endereço da aba atual; de novo, tira.
  async function toggleBookmark() {
    if (!currentTab?.url) return;
    setError(undefined);
    try {
      setBookmarks(
        currentBookmark
          ? await browserBookmarkRemove(currentBookmark.id)
          : await browserBookmarkAdd(currentTab.url, tabLabel(currentTab)),
      );
    } catch (err) {
      setError(String(err));
    }
  }

  /// Abre um favorito na aba atual, ou numa aba nova se não há nenhuma.
  async function openBookmark(bookmark: BrowserBookmark) {
    if (current === null) return openTab(bookmark.url);
    setError(undefined);
    try {
      const url = await browserNavigate(bookmark.url);
      setAddress(url);
      setTabs((list) => list.map((tab) => (tab.id === current ? { ...tab, url } : tab)));
    } catch (err) {
      setError(String(err));
    }
  }

  async function removeBookmark(id: string) {
    setError(undefined);
    try {
      setBookmarks(await browserBookmarkRemove(id));
    } catch (err) {
      setError(String(err));
    }
  }

  function history(direction: "back" | "forward") {
    browserHistory(direction).catch((err) => setError(String(err)));
  }

  function reload() {
    browserReload().catch((err) => setError(String(err)));
  }

  return (
    <div className="browser">
      <div className="browser__tabs" role="tablist" aria-label={t("browser.tabsAria")}>
        {tabs.map((tab) => (
          <div key={tab.id} className={`browser__tab${tab.id === current ? " browser__tab--active" : ""}`}>
            <button
              type="button"
              role="tab"
              aria-selected={tab.id === current}
              className="browser__tab-title"
              title={tab.url || t("browser.blankTab")}
              onClick={() => void switchTo(tab)}
            >
              {tabLabel(tab)}
            </button>
            <button
              type="button"
              className="browser__tab-close"
              aria-label={t("browser.closeTab", { title: tabLabel(tab) })}
              onClick={() => void closeTab(tab.id)}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="browser__btn"
          aria-label={t("browser.newTab")}
          title={tabs.length >= MAX_TABS ? t("browser.tabLimit", { max: MAX_TABS }) : t("browser.newTab")}
          disabled={tabs.length >= MAX_TABS}
          onClick={() => void openTab(null)}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>

      <form className="browser__bar" onSubmit={go}>
        <button type="button" className="browser__btn" aria-label={t("browser.back")} title={t("browser.back")} disabled={current === null} onClick={() => history("back")}>
          <ArrowLeft size={14} aria-hidden="true" />
        </button>
        <button type="button" className="browser__btn" aria-label={t("browser.forward")} title={t("browser.forward")} disabled={current === null} onClick={() => history("forward")}>
          <ArrowRight size={14} aria-hidden="true" />
        </button>
        <button type="button" className="browser__btn" aria-label={t("browser.reload")} title={t("browser.reload")} disabled={current === null} onClick={reload}>
          <RotateCw size={14} aria-hidden="true" />
        </button>
        <input
          className="browser__address"
          aria-label={t("browser.addressAria")}
          placeholder={t("browser.addressPlaceholder")}
          value={address}
          spellCheck={false}
          onChange={(e) => setAddress(e.target.value)}
        />
        <button
          type="button"
          className={`browser__btn${currentBookmark ? " browser__btn--on" : ""}`}
          aria-pressed={Boolean(currentBookmark)}
          aria-label={currentBookmark ? t("browser.bookmarkRemove") : t("browser.bookmarkAdd")}
          title={currentBookmark ? t("browser.bookmarkRemove") : t("browser.bookmarkAdd")}
          disabled={!currentTab?.url}
          onClick={() => void toggleBookmark()}
        >
          <Star size={14} aria-hidden="true" fill={currentBookmark ? "currentColor" : "none"} />
        </button>
      </form>

      {bookmarks.length > 0 && (
        <ul className="browser__bookmarks" aria-label={t("browser.bookmarksAria")}>
          {bookmarks.map((bookmark) => (
            <li key={bookmark.id} className="browser__bookmark">
              <button type="button" className="browser__bookmark-open" title={bookmark.url} onClick={() => void openBookmark(bookmark)}>
                {bookmark.title}
              </button>
              <button
                type="button"
                className="browser__tab-close"
                aria-label={t("browser.bookmarkDelete", { title: bookmark.title })}
                onClick={() => void removeBookmark(bookmark.id)}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="browser__error" role="alert">
          {error}
        </p>
      )}
      <div className="browser__view" ref={area}>
        {current === null && <EmptyState icon={<Globe size={18} />}>{t("browser.empty")}</EmptyState>}
      </div>
    </div>
  );
}
