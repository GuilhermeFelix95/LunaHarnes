import { useRef, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/// Bloco de código com botão de copiar, no estilo do Claude.
function CodeBlock({ children }: { children?: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard?.writeText(preRef.current?.textContent ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="code-block">
      <button type="button" className="code-block__copy" onClick={copy}>
        {copied ? "Copiado" : "Copiar"}
      </button>
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
