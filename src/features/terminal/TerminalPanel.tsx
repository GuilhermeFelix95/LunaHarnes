import { useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { onTerminalData, onTerminalExit, terminalClose, terminalOpen, terminalResize, terminalWrite } from "../../api";

interface TerminalPanelProps {
  /** Pasta onde o shell começa. Quem usa o painel troca a pasta com key={cwd}, o que reinicia o shell. */
  cwd: string;
}

/// Shell embutido no chat. Abre um PowerShell na pasta do projeto quando é montado.
export function TerminalPanel({ cwd }: TerminalPanelProps) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"opening" | "running" | "closed" | "error">("opening");
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!host.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, "Cascadia Code", Consolas, monospace',
      fontSize: 13,
      convertEol: true,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host.current);
    fit.fit();

    let id: string | undefined;
    let disposed = false;
    const unlisteners: Array<Promise<() => void>> = [];

    unlisteners.push(
      onTerminalData((event) => {
        if (event.id === id) term.write(event.data);
      }),
    );
    unlisteners.push(
      onTerminalExit((exited) => {
        if (exited !== id) return;
        setStatus("closed");
        term.write("\r\n[shell encerrado]\r\n");
      }),
    );

    const input = term.onData((data) => {
      if (id) void terminalWrite(id, data).catch((e) => setError(String(e)));
    });

    const resize = new ResizeObserver(() => {
      fit.fit();
      if (id) void terminalResize(id, term.cols, term.rows).catch(() => {});
    });
    resize.observe(host.current);

    terminalOpen(cwd, term.cols, term.rows)
      .then((opened) => {
        if (disposed) {
          void terminalClose(opened);
          return;
        }
        id = opened;
        setStatus("running");
      })
      .catch((e) => {
        setStatus("error");
        setError(String(e));
      });

    return () => {
      disposed = true;
      resize.disconnect();
      input.dispose();
      unlisteners.forEach((p) => p.then((stop) => stop()));
      if (id) void terminalClose(id).catch(() => {});
      term.dispose();
    };
    // Abre uma vez por montagem: a pasta inicial é a do projeto naquele momento.
  }, []);

  return (
    <section className="terminal" aria-label="Terminal">
      {status === "error" && <p role="alert" className="terminal__note">{error}</p>}
      {status === "opening" && <p className="terminal__note">Abrindo o terminal…</p>}
      <div ref={host} className="terminal__screen" />
    </section>
  );
}
