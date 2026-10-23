import { t } from "../../i18n";
import type { PermissionRequest } from "../../api";

interface PermissionPromptProps {
  request: PermissionRequest;
  onAllow: (request: PermissionRequest) => void;
  onAlways: (request: PermissionRequest) => void;
  onDeny: (request: PermissionRequest) => void;
}

/// O que a ação vai fazer, em uma linha: o comando, o arquivo ou a URL. Vazio quando a ferramenta não tem um.
export function describeAction(request: PermissionRequest): string {
  const detail = request.input.command ?? request.input.file_path ?? request.input.path ?? request.input.url;
  return typeof detail === "string" ? detail : "";
}

/// Pedido de confirmação no chat, antes de uma ação sensível do agente.
export function PermissionPrompt({ request, onAllow, onAlways, onDeny }: PermissionPromptProps) {
  const detail = describeAction(request);
  return (
    <div className="permission-prompt" role="alertdialog" aria-label={t("permission.title", { tool: request.toolName })}>
      <p className="permission-prompt__title">{t("permission.title", { tool: request.toolName })}</p>
      {detail && <code className="permission-prompt__detail">{detail}</code>}
      <div className="permission-prompt__actions">
        <button type="button" onClick={() => onDeny(request)}>
          {t("permission.deny")}
        </button>
        <button type="button" onClick={() => onAlways(request)}>
          {t("permission.always")}
        </button>
        <button type="button" className="permission-prompt__allow" onClick={() => onAllow(request)}>
          {t("permission.allow")}
        </button>
      </div>
    </div>
  );
}
