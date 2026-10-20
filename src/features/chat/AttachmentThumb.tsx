import { useEffect, useState } from "react";
import { readAttachment } from "../../api";
import { t } from "../../i18n";

/// Miniatura de uma imagem enviada, lida da pasta de anexos pelo caminho guardado na mensagem.
/// Se a imagem não existe mais, mostra um aviso curto no lugar.
export function AttachmentThumb({ path }: { path: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    readAttachment(path).then(
      (image) => alive && setSrc(`data:${image.mime};base64,${image.data}`),
      () => alive && setMissing(true),
    );
    return () => {
      alive = false;
    };
  }, [path]);

  if (missing) return <span className="message__attachment-missing">{t("chat.imageMissing")}</span>;
  if (!src) return null;
  return <img className="message__attachment" src={src} alt={t("composer.imageAlt")} />;
}
