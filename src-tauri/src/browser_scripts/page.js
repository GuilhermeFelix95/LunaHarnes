// Script da página do navegador do Luna. Roda dentro da webview (ver browser_actions.rs), antes de cada
// ação do agente. Não recebe nada do app: o que o agente pede entra como argumento, em literal JSON.
// Cada leitura numera os elementos visíveis com `data-luna-ref`; a numeração vale até a próxima leitura.
const __luna = (() => {
  const INTERACTIVE =
    'a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=checkbox],[role=radio],' +
    '[role=tab],[role=menuitem],[role=option],[role=switch],[contenteditable=true],[onclick],[tabindex]:not([tabindex="-1"])';
  const MAX_ITEMS = 200;
  const MAX_TEXT = 120;

  const clean = (text) => (text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  const textOf = (el) => el.innerText || el.textContent || '';

  const visible = (el) => {
    if (el.closest('[aria-hidden=true]')) return false;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    const box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  };

  // Nome que a pessoa vê. Valor de campo fica de fora: pode ser senha.
  const nameOf = (el) => {
    const labelled = (el.getAttribute('aria-labelledby') || '')
      .split(/\s+/)
      .map((id) => (document.getElementById(id) || {}).textContent || '')
      .join(' ');
    const img = el.querySelector('img[alt]');
    return clean(
      el.getAttribute('aria-label') ||
        labelled ||
        textOf(el) ||
        el.getAttribute('title') ||
        el.getAttribute('placeholder') ||
        (img && img.alt) ||
        '',
    );
  };

  const roleOf = (el) => {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    const byTag = { A: 'link', BUTTON: 'button', SELECT: 'combobox', TEXTAREA: 'textbox', SUMMARY: 'button' };
    if (byTag[el.tagName]) return byTag[el.tagName];
    if (el.tagName === 'INPUT') {
      const byType = { checkbox: 'checkbox', radio: 'radio', submit: 'button', button: 'button', password: 'textbox' };
      return byType[el.type] || 'textbox';
    }
    return 'control';
  };

  const dialogOf = (el) => el.closest('[role=dialog],[aria-modal=true],dialog');
  const dialogTitle = (dialog) => clean(dialog.getAttribute('aria-label') || (dialog.querySelector('h1,h2,h3') || {}).textContent || '');

  // Com um diálogo aberto, os controles dele vêm primeiro: senão o limite de itens corta o botão Fechar.
  const orderedCandidates = () => {
    const all = [...document.querySelectorAll(INTERACTIVE)].filter(visible);
    const open = document.querySelector('[role=dialog],[aria-modal=true],dialog[open]');
    if (!open) return all;
    return [...all.filter((el) => open.contains(el)), ...all.filter((el) => !open.contains(el))];
  };

  // Campo de senha, login, CAPTCHA ou confirmação de conta: o agente para e pede ajuda à pessoa.
  const blocker = () => {
    const text = textOf(document.body || document.documentElement).slice(0, 5000).toLowerCase();
    const captchaFrame = document.querySelector('iframe[src*="recaptcha"],iframe[src*="hcaptcha"],iframe[src*="challenges.cloudflare"],[data-sitekey],.g-recaptcha,.cf-turnstile');
    if (captchaFrame || /captcha|não sou um robô|i'?m not a robot|verifique que você é (um )?humano|confirme que você é humano|verify you are human/.test(text)) {
      return 'captcha';
    }
    if (/código de verificação|verification code|autenticação de dois fatores|two-factor|confirme sua conta|confirm your account/.test(text)) {
      return 'confirmacao';
    }
    if ([...document.querySelectorAll('input[type=password]')].some(visible)) return 'login';
    return null;
  };

  const target = (ref) => document.querySelector(`[data-luna-ref="${ref}"]`);
  const missing = { ok: false, error: 'elemento não encontrado: a página mudou, faça um novo browser_snapshot' };

  // Acha o elemento que rola: o primeiro ancestral com conteúdo acima da área visível.
  const scrollableFrom = (el) => {
    let node = el;
    while (node && node !== document.body) {
      if (node.scrollHeight > node.clientHeight + 1) return node;
      node = node.parentElement;
    }
    return null;
  };

  const setNativeValue = (el, value) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  };

  return {
    snapshot() {
      document.querySelectorAll('[data-luna-ref]').forEach((el) => el.removeAttribute('data-luna-ref'));
      const items = [];
      for (const el of orderedCandidates()) {
        if (items.length >= MAX_ITEMS) break;
        const ref = items.length + 1;
        el.setAttribute('data-luna-ref', String(ref));
        const box = el.getBoundingClientRect();
        const dialog = dialogOf(el);
        items.push({
          ref,
          role: roleOf(el),
          name: nameOf(el),
          x: Math.round(box.x + box.width / 2),
          y: Math.round(box.y + box.height / 2),
          dialog: dialog ? dialogTitle(dialog) : null,
          disabled: el.disabled === true,
        });
      }
      return { url: location.href, title: document.title, blocker: blocker(), items };
    },

    // Nome e papel de um elemento, para a aplicação decidir se a ação é sensível antes de rodá-la.
    inspect(ref) {
      const el = target(ref);
      if (!el) return missing;
      return { ok: true, name: nameOf(el), role: roleOf(el) };
    },

    act(ref, action, value) {
      const el = target(ref);
      if (!el) return missing;
      el.scrollIntoView({ block: 'center' });
      if (action === 'click') {
        el.click();
        return { ok: true };
      }
      if (action === 'type') {
        el.focus();
        if (el.isContentEditable) {
          el.textContent = value;
        } else {
          setNativeValue(el, value);
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true };
      }
      return { ok: false, error: `ação desconhecida: ${action}` };
    },

    // Tecla no elemento da referência, ou no que tem o foco. Chega ao documento, onde modais escutam Esc.
    key(name, ref) {
      const el = (ref && target(ref)) || document.activeElement || document.body;
      const options = { key: name, code: name, bubbles: true, cancelable: true };
      el.dispatchEvent(new KeyboardEvent('keydown', options));
      el.dispatchEvent(new KeyboardEvent('keyup', options));
      return { ok: true };
    },

    // Rola a área de um elemento, ou a área sob o centro da tela, que é onde fica um modal.
    scroll(amount, ref) {
      const start = (ref && target(ref)) || document.elementFromPoint(innerWidth / 2, innerHeight / 2) || document.body;
      const node = scrollableFrom(start);
      if (node) {
        node.scrollBy(0, amount);
        return { ok: true, where: 'elemento' };
      }
      window.scrollBy(0, amount);
      return { ok: true, where: 'página' };
    },

    hasText(text) {
      return textOf(document.body || document.documentElement).toLowerCase().includes(text.toLowerCase());
    },

    // Resultados de uma busca: links para outros sites, com o texto que o usuário veria.
    links() {
      return [...document.querySelectorAll('a[href^="http"]')]
        .filter((a) => visible(a) && new URL(a.href).host !== location.host && nameOf(a))
        .slice(0, 10)
        .map((a) => ({ text: nameOf(a), href: a.href }));
    },

    blocker,
  };
})();
