import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/** Distância do fim (px) que ainda conta como "no fim". */
const THRESHOLD = 40;

/// Rolagem que segue o fim enquanto o conteúdo cresce.
/// Se o usuário rolar para cima, para onde ele está; voltar ao fim (rolando ou pelo botão) religa.
export function useStickToBottom<T extends HTMLElement>(ref: RefObject<T | null>, content: unknown) {
  const [stuck, setStuck] = useState(true);
  const stuckRef = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onScroll() {
      const atEnd = el!.scrollHeight - el!.scrollTop - el!.clientHeight <= THRESHOLD;
      stuckRef.current = atEnd;
      setStuck(atEnd);
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [ref]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && stuckRef.current) el.scrollTop = el.scrollHeight;
  }, [ref, content]);

  const scrollToBottom = useCallback(() => {
    stuckRef.current = true;
    setStuck(true);
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ref]);

  return { stuck, scrollToBottom };
}
