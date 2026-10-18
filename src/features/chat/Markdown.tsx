import { Children, isValidElement, useRef, useState, type ReactNode } from "react";
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

const components: Components = {
  pre: CodeBlock,
  // Links não navegam dentro da janela do app. Sem HTML bruto: react-markdown escapa tags.
  a: ({ href, children }) => (
    <span className="md-link" title={href}>
      {children}
    </span>
  ),
};

/// Renderiza a resposta do modelo como markdown (GFM). HTML bruto aparece como texto.
export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
