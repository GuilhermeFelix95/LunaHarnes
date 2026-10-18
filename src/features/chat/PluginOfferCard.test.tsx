import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installLocalPlugin, inspectLocalPlugin } from "../../api";
import { PluginOfferCard } from "./PluginOfferCard";

vi.mock("../../api", () => ({
  PLUGINS_CHANGED: "luna:plugins-changed",
  inspectLocalPlugin: vi.fn(async () => ({
    id: "contador",
    name: "Contador",
    version: "1.0.0",
    entry: "index.js",
    permissions: ["commands"],
  })),
  installLocalPlugin: vi.fn(async () => ({})),
}));

describe("PluginOfferCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra o nome da pasta e só mostra as permissões depois de Instalar", async () => {
    render(<PluginOfferCard folder={"C:\\dados\\plugin-drafts\\contador"} onInstalled={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByText(/A Luna criou o plugin contador/)).toBeTruthy();
    expect(screen.queryByText("Este plugin vai pedir estas permissões:")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Instalar" }));

    expect(await screen.findByText("Este plugin vai pedir estas permissões:")).toBeTruthy();
    expect(screen.getByText("registra comandos com barra, como /nome")).toBeTruthy();
    expect(inspectLocalPlugin).toHaveBeenCalledWith("C:\\dados\\plugin-drafts\\contador");
    expect(installLocalPlugin).not.toHaveBeenCalled();
  });

  it("confirmar instala a pasta e avisa a conversa", async () => {
    const onInstalled = vi.fn();
    render(<PluginOfferCard folder="/dados/plugin-drafts/contador" onInstalled={onInstalled} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Instalar" }));
    await screen.findByText("Este plugin vai pedir estas permissões:");
    fireEvent.click(screen.getAllByRole("button", { name: "Instalar" }).at(-1)!);

    await waitFor(() => expect(installLocalPlugin).toHaveBeenCalledWith("/dados/plugin-drafts/contador"));
    expect(onInstalled).toHaveBeenCalledWith("Contador instalado. Ele vale no próximo envio.");
  });

  it("Agora não fecha o cartão sem instalar", () => {
    const onDismiss = vi.fn();
    render(<PluginOfferCard folder="/dados/plugin-drafts/contador" onInstalled={vi.fn()} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(installLocalPlugin).not.toHaveBeenCalled();
  });
});
