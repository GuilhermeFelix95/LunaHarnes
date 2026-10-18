import { useState } from "react";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { installLocalPlugin, inspectLocalPlugin, PLUGINS_CHANGED } from "../../api";
import { folderName } from "../../chat/pluginOffer";
import { PERMISSION_TEXT } from "../../plugins/permissions";
import type { PluginManifest } from "../../plugins/host";

interface PluginOfferCardProps {
  /** Pasta do rascunho que a Luna criou (ou que foi digitada em `/plugin instalar`). */
  folder: string;
  /** Mensagem de sucesso para a conversa. */
  onInstalled: (message: string) => void;
  onDismiss: () => void;
}

/// Cartão "A Luna criou o plugin X: Instalar". Instalar lê o manifesto e mostra as permissões antes de copiar.
export function PluginOfferCard({ folder, onInstalled, onDismiss }: PluginOfferCardProps) {
  const [manifest, setManifest] = useState<PluginManifest | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  async function review() {
    setError(undefined);
    try {
      setManifest(await inspectLocalPlugin(folder));
    } catch (e) {
      setError(String(e));
    }
  }

  async function install() {
    if (!manifest) return;
    setError(undefined);
    try {
      await installLocalPlugin(folder);
      window.dispatchEvent(new Event(PLUGINS_CHANGED));
      setManifest(undefined);
      onInstalled(`${manifest.name} instalado. Ele vale no próximo envio.`);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <section className="plugin-offer" aria-label="Plugin pronto para instalar">
      <p>
        <strong>A Luna criou o plugin {folderName(folder)}.</strong>
      </p>
      {error && <p role="alert" className="message__error">{error}</p>}
      <div className="api-form__actions">
        <button type="button" onClick={() => void review()}>
          Instalar
        </button>
        <button type="button" onClick={onDismiss}>
          Agora não
        </button>
      </div>

      {manifest && (
        <ConfirmDialog
          title={`Instalar ${manifest.name}?`}
          body={
            <>
              <p>Este plugin vai pedir estas permissões:</p>
              <ul>
                {manifest.permissions.map((perm) => (
                  <li key={perm}>{PERMISSION_TEXT[perm] ?? `permissão "${perm}"`}</li>
                ))}
              </ul>
            </>
          }
          confirmLabel="Instalar"
          onCancel={() => setManifest(undefined)}
          onConfirm={() => void install()}
        />
      )}
    </section>
  );
}
