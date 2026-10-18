import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installMcpFromCatalog, listMcpServers } from "../../api";
import { McpSection } from "./McpSection";

vi.mock("../../api", () => ({
  listMcpServers: vi.fn(async () => []),
  loadMcpCatalog: vi.fn(async () => ({
    servers: [
      { id: "github", name: "GitHub", description: "Repositórios", author: "MCP", transport: "stdio", command: "npx", args: ["-y", "srv"], env: [{ key: "TOKEN", label: "Token pessoal" }] },
    ],
  })),
  installMcpFromCatalog: vi.fn(async () => {}),
  removeMcpServer: vi.fn(async () => {}),
  setMcpEnabled: vi.fn(async () => {}),
  MCP_CHANGED: "luna:mcp-changed",
}));

describe("McpSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mostra o comando exato antes de instalar e só libera com a confirmação e o token", async () => {
    render(<McpSection />);
    fireEvent.click(screen.getByRole("tab", { name: "Marketplace" }));
    fireEvent.click(await screen.findByRole("button", { name: "Instalar" }));

    expect(screen.getByRole("dialog").textContent).toContain("npx -y srv");
    const buttons = screen.getAllByRole("button", { name: "Instalar" });
    const confirm = buttons[buttons.length - 1] as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Token pessoal"), { target: { value: "ghp_teste" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getAllByRole("button", { name: "Instalar" }).at(-1)!);

    await waitFor(() => expect(installMcpFromCatalog).toHaveBeenCalledWith("github", { TOKEN: "ghp_teste" }));
  });

  it("lista os servidores instalados com o estado e as CLIs", async () => {
    vi.mocked(listMcpServers).mockResolvedValueOnce([
      { name: "memoria", transport: "stdio", command: "npx", args: [], env: {}, engines: ["claude", "codex"], enabled: true },
    ]);
    render(<McpSection />);

    expect(await screen.findByText("ligado · claude e codex · local")).toBeTruthy();
  });
});
