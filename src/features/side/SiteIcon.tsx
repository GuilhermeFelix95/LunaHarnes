import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { browserFavicon } from "../../api";

/// Ícone por endereço de página, guardado na sessão: uma página não é consultada duas vezes.
const icons = new Map<string, string | null>();

/// Ícone do site da aba ou do favorito. Sem ícone (ou sem resposta), mostra um globo.
export function SiteIcon({ url }: { url: string }) {
  const [icon, setIcon] = useState<string | null>(() => icons.get(url) ?? null);

  useEffect(() => {
    if (!/^https?:\/\//.test(url)) return;
    if (icons.has(url)) {
      setIcon(icons.get(url) ?? null);
      return;
    }
    let alive = true;
    browserFavicon(url).then(
      (found) => {
        icons.set(url, found);
        if (alive) setIcon(found);
      },
      () => {
        // Falha de rede: o globo fica, e a próxima vez tenta de novo.
      },
    );
    return () => {
      alive = false;
    };
  }, [url]);

  if (icon) return <img className="browser__site-icon" src={icon} alt="" aria-hidden="true" />;
  return <Globe className="browser__site-icon browser__site-icon--fallback" size={13} aria-hidden="true" />;
}
