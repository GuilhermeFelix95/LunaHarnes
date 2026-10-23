import { useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { BrowserBookmark } from "../../api";
import { t } from "../../i18n";
import { SiteIcon } from "./SiteIcon";

const GAP = 4;
/// Largura reservada para o botão » quando ele aparece.
const MORE_WIDTH = 32;

interface BookmarkBarProps {
  bookmarks: BrowserBookmark[];
  onOpen: (bookmark: BrowserBookmark) => void;
  onRemove: (id: string) => void;
}

/// Barra de favoritos em uma linha, sem rolagem. O que não cabe fica atrás do botão » (como no Firefox).
export function BookmarkBar({ bookmarks, onOpen, onRemove }: BookmarkBarProps) {
  const list = useRef<HTMLUListElement>(null);
  // Largura de cada favorito quando ele está visível: o escondido não tem medida, então usa a última conhecida.
  const widths = useRef(new Map<string, number>());
  const [fit, setFit] = useState(bookmarks.length);
  const [menuOpen, setMenuOpen] = useState(false);

  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;

    function measure() {
      const available = el!.clientWidth;
      // Sem layout (painel fechado ou ainda não pintado): mostra todos, para nenhum favorito sumir.
      if (available === 0) {
        setFit(bookmarks.length);
        return;
      }
      const chips = Array.from(el!.children) as HTMLElement[];
      const sizes = bookmarks.map((bookmark) => {
        const chip = chips.find((item) => item.dataset.bookmarkId === bookmark.id);
        if (chip && chip.offsetWidth > 0) widths.current.set(bookmark.id, chip.offsetWidth);
        return widths.current.get(bookmark.id) ?? 0;
      });
      const total = sizes.reduce((sum, width) => sum + width + GAP, -GAP);
      if (total <= available) {
        setFit(bookmarks.length);
        return;
      }
      let used = 0;
      let count = 0;
      for (const width of sizes) {
        if (used + width + MORE_WIDTH > available) break;
        used += width + GAP;
        count += 1;
      }
      setFit(count);
    }

    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [bookmarks]);

  const hidden = bookmarks.slice(fit);

  return (
    <div className="browser__bookmarks-row">
      <ul ref={list} className="browser__bookmarks" aria-label={t("browser.bookmarksAria")}>
        {bookmarks.length === 0 && <li className="browser__visit browser__visit--empty">{t("browser.bookmarksEmpty")}</li>}
        {bookmarks.map((bookmark, index) => (
          <li
            key={bookmark.id}
            data-bookmark-id={bookmark.id}
            className={`browser__bookmark${index >= fit ? " browser__bookmark--hidden" : ""}`}
          >
            <button type="button" className="browser__bookmark-open" title={bookmark.url} onClick={() => onOpen(bookmark)}>
              <SiteIcon url={bookmark.url} />
              {bookmark.title}
            </button>
            <button
              type="button"
              className="browser__tab-close"
              aria-label={t("browser.bookmarkDelete", { title: bookmark.title })}
              onClick={() => onRemove(bookmark.id)}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {hidden.length > 0 && (
        <div className="browser__bookmarks-more-wrap">
          <button
            type="button"
            className="browser__bookmarks-more"
            aria-label={t("browser.moreBookmarks")}
            title={t("browser.moreBookmarks")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            »
          </button>
          {menuOpen && (
            <ul className="browser__bookmarks-menu" role="menu" aria-label={t("browser.moreBookmarks")}>
              {hidden.map((bookmark) => (
                <li key={bookmark.id} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="browser__bookmarks-menu-item"
                    title={bookmark.url}
                    onClick={() => {
                      setMenuOpen(false);
                      onOpen(bookmark);
                    }}
                  >
                    <SiteIcon url={bookmark.url} />
                    {bookmark.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
