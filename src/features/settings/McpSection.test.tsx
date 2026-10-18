import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installMcpFromCatalog, listMcpServers, reconfigureMcpServer, saveMcpServer, type McpServer } from "../../api";
import { McpSection } from "./McpSection";

vi.mock("../../api", () => ({
  listMcpServers: vi.fn(async () => []),
  loadMcpCatalog: vi.fn(async () => ({
    servers: [
      {
        id: "github",
        name: "GitHub",
        description: "Repositórios",
        author: "MCP",
        transport: "stdio",
        command: "npx",
        args: ["-y", "srv"],
        env: [{ key: "GITHUB_PERSONAL_ACCESS_TOKEN", label: "Defina a variável no ambiente" }],
      },
    ],
  })),
  installMcpFromCatalog: vi.fn(async () => {}),
  saveMcpServer: vi.fn(async () => {}),
  reconfigureMcpServer: vi.fn(async () => {}),
  removeMcpServer: vi.fn(async () => {}),
  setMcpEnabled: vi.fn(async () => {}),
  listMcpSources: vi.fn(async () => []),
  addMcpSource: vi.fn(async () => []),
  removeMcpSource: vi.fn(async () => []),
  MCP_CHANGED: "luna:mcp-changed",
}));

const memoria: McpServer = { name: "memoria", transport: "stdio", command: "npx", args: [], envVars: [], literalEnv: [], engines: ["claude", "codex"], enabled: true };

describe("McpSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mostra o comando e a variável antes de instalar, e só libera com a confirmação", async () => {
    render(<McpSection />);
    fireEvent.click(screen.getByRole("tab", { name: "Marketplace" }));
    fireEvent.click(await screen.findByRole("button", { name: "Instalar" }));

    expect(screen.getByRole("dialog").textContent).toContain("npx -y srv");
    expect(screen.getByRole("dialog").textContent).toContain("GITHUB_PERSONAL_ACCESS_TOKEN");
    const confirm = () => screen.getAllByRole("button", { name: "Instalar" }).at(-1) as HTMLButtonElement;
    expect(confirm().disabled).toBe(true);

    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirm().disabled).toBe(false);
    fireEvent.click(confirm());

    await waitFor(() => expect(installMcpFromCatalog).toHaveBeenCalledWith("github", undefined));
  });

  it("não tem campo de senha: o app nunca recebe um valor", async () => {
    const { container } = render(<McpSection />);
    fireEvent.click(screen.getByRole("tab", { name: "Marketplace" }));
    fireEvent.click(await screen.findByRole("button", { name: "Instalar" }));

    expect(container.querySelector('input[type="password"]')).toBeNull();
  });

  it("adiciona um servidor à mão só com os nomes das variáveis e depois da confirmação", async () => {
    render(<McpSection />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar MCP" }));

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "memoria" } });
    fireEvent.change(screen.getByLabelText("Comando"), { target: { value: "npx" } });
    fireEvent.change(screen.getByLabelText("Argumentos (separados por espaço)"), { target: { value: "-y servidor" } });
    fireEvent.change(screen.getByLabelText("Variáveis do ambiente"), { target: { value: "TOKEN_X" } });
    const confirm = () => screen.getByRole("button", { name: "Adicionar" }) as HTMLButtonElement;
    expect(confirm().disabled).toBe(true);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(confirm());

    await waitFor(() =>
      expect(saveMcpServer).toHaveBeenCalledWith({
        name: "memoria",
        transport: "stdio",
        command: "npx",
        args: ["-y", "servidor"],
        url: undefined,
        envVars: ["TOKEN_X"],
      }),
    );
  });

  it("recusa nome de variável que não é um nome (ex.: um valor colado) sem chamar o app", async () => {
    render(<McpSection />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar MCP" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "memoria" } });
    fireEvent.change(screen.getByLabelText("Comando"), { target: { value: "npx" } });
    fireEvent.change(screen.getByLabelText("Variáveis do ambiente"), { target: { value: "TOKEN=ghp_segredo" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByText(/Nome de variável inválido/)).toBeTruthy();
    expect(saveMcpServer).not.toHaveBeenCalled();
  });

  it("lista os servidores instalados com o estado e as CLIs", async () => {
    vi.mocked(listMcpServers).mockResolvedValueOnce([memoria]);
    render(<McpSection />);

    expect(await screen.findByText("ligado · claude e codex · local")).toBeTruthy();
  });

  it("servidor com segredo em texto mostra só o nome da variável e pede Reconfigurar", async () => {
    vi.mocked(listMcpServers).mockResolvedValueOnce([{ ...memoria, literalEnv: ["TOKEN_X"] }]);
    render(<McpSection />);

    expect(await screen.findByText(/Segredo gravado em texto nas configurações: TOKEN_X/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reconfigurar" }));
    await waitFor(() => expect(reconfigureMcpServer).toHaveBeenCalledWith("memoria"));
    expect(screen.queryByRole("button", { name: "Desligar" })).toBeNull();
  });
});
