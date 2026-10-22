import { Children, isValidElement, memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/// Linguagem do bloco, vinda da classe `language-xxx` que o remark põe no <code>.
function languageOf(children: ReactNode): string | undefined {
  const code = Children.toArray(children).find(isValidElement<{ className?: string }>);
  return /language-([\w-]+)/.exec(code?.props.className ?? "")?.[1];
}

/// Bloco de código com cabeçalho: linguagem à esquerda e botão de copiar à direita.
function CodeBlock({ children }: { children?: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const language = languageOf(children);

  function copy() {
    void navigator.clipboard?.writeText(preRef.current?.textContent ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="code-block">
      <div className="code-block__head">
        <span className="code-block__lang">{language ?? "texto"}</span>
        <button type="button" className="code-block__copy" onClick={copy}>
          {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre ref={preRef}>{children}</pre>
    </div>
  );
}

/// Só http e https viram link; qualquer outro esquema (javascript:, file:) continua texto.
function webUrl(href?: string): string | undefined {
  try {
    const url = new URL(href ?? "");
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

let controlWatched = false;

/// Marca o <html> com `ctrl-down` enquanto Ctrl estiver apertado, para os links mostrarem que são clicáveis.
function watchControlKey() {
  if (controlWatched) return;
  controlWatched = true;
  const root = document.documentElement;
  const sync = (e: KeyboardEvent | MouseEvent) => root.classList.toggle("ctrl-down", e.ctrlKey);
  window.addEventListener("keydown", sync);
  window.addEventListener("keyup", sync);
  window.addEventListener("blur", () => root.classList.remove("ctrl-down"));
}

function buildComponents(onOpenLink?: (url: string) => void): Components {
  return {
    pre: CodeBlock,
    // Links não navegam dentro da janela do app. Ctrl+clique abre o link no navegador integrado. Sem HTML bruto: react-markdown escapa tags.
    a: ({ href, children }) => {
      const url = webUrl(href);
      if (!url) return <span className="md-link">{children}</span>;
      return (
        <a
          href={url}
          className="md-link md-link--web"
          title={url}
          onClick={(e) => {
            e.preventDefault();
            if ((e.ctrlKey || e.metaKey) && onOpenLink) onOpenLink(url);
          }}
        >
          {children}
        </a>
      );
    },
  };
}

/// Renderiza a resposta do modelo como markdown (GFM). HTML bruto aparece como texto.
// memo: digitar no composer re-renderiza o chat inteiro; o texto de cada mensagem não muda, então não é refeito.
export const Markdown = memo(function Markdown({ text, onOpenLink }: { text: string; onOpenLink?: (url: string) => void }) {
  useEffect(() => watchControlKey(), []);
  const components = useMemo(() => buildComponents(onOpenLink), [onOpenLink]);
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
