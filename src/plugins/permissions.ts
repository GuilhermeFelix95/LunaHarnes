import { t, type MessageKey } from "../i18n";

/// Chave de cada permissão que um plugin pode pedir. A explicação sai no idioma da interface.
const PERMISSION_KEYS: Record<string, MessageKey> = {
  commands: "permission.commands",
  hooks: "permission.hooks",
  modes: "permission.modes",
  cache: "permission.cache",
  ui: "permission.ui",
  theme: "permission.theme",
  autofix: "permission.autofix",
};

/// Explica uma permissão para os diálogos de instalação. Permissão desconhecida vira "permissão X".
export function permissionText(perm: string): string {
  const key = PERMISSION_KEYS[perm];
  return key ? t(key) : t("plugins.permissionFallback", { perm });
}
