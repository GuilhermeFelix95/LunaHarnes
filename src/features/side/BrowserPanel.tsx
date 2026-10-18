import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Globe, RotateCw } from "lucide-react";
import { browserHistory, browserNavigate, browserOpen, browserReload, browserSetBounds, browserShow, type BrowserBounds } from "../../api";
import { EmptyState } from "../../ui/EmptyState";

interface BrowserPanelProps {
  /** Aba do navegador à mostra. Fora dela, a página sai de cena para não cobrir o chat. */
  active: boolean;
}

/// Área onde a página aparece: a webview do navegador fica exatamente sobre este elemento.
function measure(area: HTMLElement): BrowserBounds {
  const rect = area.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

/// Navegador embutido. A página é uma webview filha da janela, então ela não usa iframe e funciona com sites que bloqueiam iframes.
export function BrowserPanel({ active }: BrowserPanelProps) {
  const area = useRef<HTMLDivElement>(null);
  const [address, setAddress] = useState("");
  // Liga quando a página existe: pela primeira vez que a aba aparece com um navegador já aberto, ou depois de um endereço digitado.
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Mostra a página quando a aba está à vista e esconde quando sai. Sem página, o pedido não faz nada.
  useEffect(() => {
    if (!active) {
      browserShow(false).catch(() => {});
      return;
    }
    browserShow(true).then(
      () => setOpened(true),
      () => {},
    );
  }, [active]);

  // Acompanha a área com a webview: muda com o tamanho do painel e da janela.
  useEffect(() => {
    const el = area.current;
    if (!opened || !active || !el) return;
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
  }, [opened, active]);

  async function go(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const target = address.trim();
    const el = area.current;
    if (!target || !el) return;
    setError(undefined);
    try {
      if (opened) {
        setAddress(await browserNavigate(target));
      } else {
        await browserOpen(target, measure(el));
        setOpened(true);
        setAddress(target);
      }
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
      <form className="browser__bar" onSubmit={go}>
        <button type="button" className="browser__btn" aria-label="Voltar" title="Voltar" disabled={!opened} onClick={() => history("back")}>
          <ArrowLeft size={14} aria-hidden="true" />
        </button>
        <button type="button" className="browser__btn" aria-label="Avançar" title="Avançar" disabled={!opened} onClick={() => history("forward")}>
          <ArrowRight size={14} aria-hidden="true" />
        </button>
        <button type="button" className="browser__btn" aria-label="Recarregar" title="Recarregar" disabled={!opened} onClick={reload}>
          <RotateCw size={14} aria-hidden="true" />
        </button>
        <input
          className="browser__address"
          aria-label="Endereço"
          placeholder="Digite um endereço, como exemplo.com"
          value={address}
          spellCheck={false}
          onChange={(e) => setAddress(e.target.value)}
        />
      </form>
      {error && (
        <p className="browser__error" role="alert">
          {error}
        </p>
      )}
      <div className="browser__view" ref={area}>
        {!opened && <EmptyState icon={<Globe size={18} />}>Digite um endereço acima. O agente também pode abrir páginas aqui.</EmptyState>}
      </div>
    </div>
  );
}
