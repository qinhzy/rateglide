import css from './style.css';
import { t, setLanguage, getLanguage, getLocale } from '../i18n';
import { parseMoney } from '../core/parser';
import { ext, otherCurrency, siteBlocked } from '../core/storage';
import {
  currencies,
  currencyCodes,
  currencyName,
  flag,
  formatAmount,
  formatRate,
} from '../data/currencies';
import { DEFAULTS, type Settings, type ParsedMoney, type Quote } from '../core/types';
const api = ext!;
let settings: Settings = DEFAULTS;
let host: HTMLElement | null = null,
  wrap: HTMLElement | null = null,
  box: HTMLElement | null = null;
let selected: ParsedMoney | null = null;
let anchor = { x: 16, y: 16, bottom: 30 };
// The selected text, so the popup can follow it while the page scrolls.
let anchorRange: Range | null = null,
  followFrame = 0;
let requestId = 0,
  selectionTimer: ReturnType<typeof setTimeout> | undefined;
let lastText = '',
  lastAlt = false;
let from = '',
  to = '';
let current: Quote | null = null;
const paths: Record<string, string> = {
  logo: 'M3 5h4l10 14h4 M17 15l4 4-4 2 M3 19h4L17 5h4 M17 2l4 3-4 4',
  close: 'M6 6l12 12 M6 18L18 6',
  copy: 'M9 9h11v12H9z M5 16H3V3h12v2',
  compare: 'M4 18V9 M10 18V4 M16 18v-7 M2 21h19',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
};
function icon(name: string) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(s.namespaceURI, 'path');
  p.setAttribute('d', paths[name]);
  s.append(p);
  return s;
}
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = t(text);
  return e;
}
async function rpc<T = any>(message: Record<string, unknown>): Promise<T> {
  try {
    const r = await api.runtime.sendMessage(message);
    if (!r?.ok) throw new Error(r?.error || '汇率暂不可用');
    return r.data;
  } catch (e) {
    if (!api.runtime.id) throw new Error('扩展已更新，请刷新网页后重试');
    throw e;
  }
}
// Selections made while preferences are still loading wait for them, so the first
// prompt already uses the saved home currency and language.
const ready = rpc<Settings>({ type: 'settings' })
  .then((s) => {
    settings = s;
    setLanguage(s.language || 'system');
  })
  .catch(() => {});
api.storage.onChanged.addListener((changes) => {
  if (changes.settings?.newValue) {
    const oldLanguage = settings.language;
    settings = { ...DEFAULTS, ...changes.settings.newValue };
    setLanguage(settings.language);
    if (oldLanguage !== settings.language) hide();
    if (!settings.enabled || siteBlocked(location.host, settings.blockedSites)) hide();
    else if (wrap) wrap.dataset.theme = settings.theme;
  }
});
function hide() {
  clearTimeout(selectionTimer);
  requestId++;
  host?.remove();
  host = null;
  wrap = null;
  box = null;
  selected = null;
  current = null;
  anchorRange = null;
  lastText = '';
}
function mount() {
  requestId++;
  box = null;
  current = null;
  host?.remove();
  host = document.createElement('huijian-helper');
  host.setAttribute('data-huijian', 'true');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = el('style');
  style.textContent = css;
  shadow.append(style);
  wrap = el('div', 'wrap');
  wrap.dataset.theme = settings.theme;
  wrap.lang = getLanguage();
  shadow.append(wrap);
  document.documentElement.append(host);
}
function position() {
  if (!wrap) return;
  const r = wrap.getBoundingClientRect();
  const width = r.width || 340,
    height = r.height || 250;
  let x = Math.min(Math.max(12, anchor.x), innerWidth - width - 12);
  let y = anchor.bottom + 9;
  if (y + height > innerHeight - 12) y = anchor.y - height - 9;
  if (y < 12) y = Math.max(12, innerHeight - height - 12);
  wrap.style.left = Math.max(12, x) + 'px';
  wrap.style.top = y + 'px';
}
function prompt(money: ParsedMoney) {
  selected = money;
  from = money.currency;
  to = settings.target;
  mount();
  const b = el('button', 'prompt', t('换算为 {0}', [to]));
  b.type = 'button';
  b.prepend(icon('logo'));
  b.addEventListener('click', () => panel(true));
  wrap!.append(b);
  position();
}
function button(label: string, name: string, action: () => void, className = 'icon') {
  label = t(label);
  const b = el('button', className, className === 'icon' ? '' : label);
  b.type = 'button';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.prepend(icon(name));
  b.addEventListener('click', action);
  return b;
}
function currencySelect(value: string, label: string, change: (v: string) => void) {
  const field = el('label', 'currency');
  const mark = el('span', 'flag');
  mark.textContent = flag(value);
  mark.setAttribute('aria-hidden', 'true');
  const s = el('select');
  s.setAttribute('aria-label', t(label));
  // Options start with the ISO code so typing “E” or “HK” jumps through the list.
  const group = (title: string, codes: string[]) => {
    const g = document.createElement('optgroup');
    g.label = t(title);
    for (const code of codes) {
      const o = document.createElement('option');
      o.value = code;
      o.textContent = `${code} · ${currencyName(code)}`;
      g.append(o);
    }
    return g;
  };
  const frequent = [...new Set([value, from, to, settings.target, ...settings.favorites])].filter(
    (c) => currencyCodes.has(c),
  );
  s.append(
    group('常用', frequent),
    group(
      '全部币种',
      currencies.map((c) => c.code),
    ),
  );
  s.value = value;
  s.addEventListener('change', () => {
    mark.textContent = flag(s.value);
    change(s.value);
  });
  field.append(mark, s);
  return field;
}
function panel(focus = false) {
  if (!selected) return;
  if (!wrap) mount();
  wrap!.replaceChildren();
  box = el('section', 'panel');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', t('汇见货币换算'));
  const head = el('div', 'head');
  const logo = icon('logo');
  logo.classList.add('brandmark');
  const close = button('关闭换算', 'close', hide);
  head.append(logo, el('b', '', 'RateGlide'), close);
  box.append(head);
  const body = el('div', 'body');
  body.append(el('div', 'original', `${formatAmount(selected.amount, from)} ${from} ≈`));
  const result = el('div', 'result', '正在换算…');
  result.setAttribute('role', 'status');
  result.setAttribute('aria-live', 'polite');
  result.setAttribute('data-result', '');
  body.append(result);
  const pair = el('div', 'pair');
  pair.append(
    currencySelect(from, '原币种', (v) => {
      from = v;
      void load();
    }),
    el('span', '', '→'),
    currencySelect(to, '目标币种', (v) => {
      to = v;
      void load();
    }),
  );
  body.append(pair);
  if (selected.ambiguous)
    body.append(el('p', 'hint', selected.hint || '已使用默认币种，可随时修改'));
  const detail = el('div');
  detail.setAttribute('data-detail', '');
  body.append(detail);
  box.append(body);
  const actions = el('div', 'actions');
  actions.append(
    button('复制结果', 'copy', () => void copy(), 'action-copy'),
    button(
      '比价',
      'compare',
      () => {
        if (selected)
          api.runtime
            .sendMessage({ type: 'openCompare', from, to, amount: selected.amount })
            .catch(() => {});
      },
      'action-compare',
    ),
    button(
      '设置',
      'settings',
      () => {
        void api.runtime.sendMessage({ type: 'openOptions' });
      },
      'action-settings',
    ),
  );
  box.append(actions);
  wrap!.append(box);
  if (focus) close.focus({ preventScroll: true });
  position();
  void load();
}
async function load() {
  const id = ++requestId;
  current = null;
  if (!box || !selected) return;
  const output = box.querySelector<HTMLElement>('[data-result]')!,
    detail = box.querySelector<HTMLElement>('[data-detail]')!;
  output.textContent = t('正在换算…');
  detail.replaceChildren();
  box.querySelector('.original')!.textContent = `${formatAmount(selected.amount, from)} ${from} ≈`;
  box.querySelector<HTMLButtonElement>('.action-copy')!.disabled = true;
  try {
    const q = await rpc<Quote>({ type: 'quote', from, to, source: settings.source });
    if (id !== requestId || !box || !selected) return;
    current = q;
    output.textContent = `${formatAmount(selected.amount * q.rate, to)} ${to}`;
    output.style.fontSize = output.textContent.length > 21 ? '23px' : '30px';
    detail.append(el('div', 'rate', `1 ${from} = ${formatRate(q.rate)} ${to}`));
    const meta = el('div', 'meta');
    const a = el('span', '', `${t(q.label)} · ${t(q.kind)}`);
    a.title = t(q.notice || '');
    meta.append(
      a,
      el(
        'span',
        '',
        `${q.stale ? t('过期缓存 · ') : q.cached ? t('缓存 · ') : ''}${new Intl.DateTimeFormat(getLocale(), { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(q.asOf)}`,
      ),
    );
    detail.append(meta);
    if (q.notice) detail.append(el('div', 'notice ' + (q.stale ? 'warning' : ''), q.notice));
    box.querySelector<HTMLButtonElement>('.action-copy')!.disabled = false;
  } catch (e) {
    if (id !== requestId || !box) return;
    output.textContent = t('暂时无法换算');
    detail.append(el('div', 'notice warning', (e as Error).message));
    const retry = el('button', 'retry', '重新获取');
    retry.addEventListener('click', () => void load());
    detail.append(retry);
  }
  position();
}
async function copy() {
  if (!current || !selected || !box) return;
  const result = selected.amount * current.rate;
  try {
    await navigator.clipboard.writeText(`${formatAmount(result, to)} ${to}`);
    const button = box.querySelector<HTMLElement>('.action-copy')!;
    button.textContent = t('已复制');
    void rpc({
      type: 'addHistory',
      entry: { amount: selected.amount, from, to, result, source: current.label },
    });
    setTimeout(() => {
      if (button.isConnected) {
        button.textContent = t('复制结果');
        button.prepend(icon('copy'));
      }
    }, 1800);
  } catch {
    const detail = box.querySelector('[data-detail]')!;
    detail.append(el('div', 'notice warning', '复制不可用，请手动选中结果后按 ⌘C。'));
  }
}
function editable(node: Node | null) {
  const elem = node instanceof Element ? node : node?.parentElement;
  return (
    !!elem?.closest(
      'input,textarea,select,[contenteditable=""],[contenteditable="true"],[role="textbox"]',
    ) || !!(elem as HTMLElement)?.isContentEditable
  );
}
function capture(force = false, text?: string) {
  const s = window.getSelection();
  if (
    !force &&
    (!settings.enabled ||
      siteBlocked(location.host, settings.blockedSites) ||
      (settings.mode === 'alt' && !lastAlt))
  )
    return;
  if (editable(s?.anchorNode ?? null) || editable(document.activeElement)) return;
  const raw = (text ?? s?.toString() ?? '').trim();
  if (!raw || (!force && raw === lastText)) return;
  if (host && s?.anchorNode && host.shadowRoot?.contains(s.anchorNode)) return;
  const money = parseMoney(raw, settings);
  // A price already in the home currency needs no prompt; the context menu and shortcut still work.
  if (!money || (!force && money.currency === settings.target)) {
    hide();
    return;
  }
  anchorRange = null;
  if (s?.rangeCount) {
    const range = s.getRangeAt(0);
    const r = range.getBoundingClientRect();
    if (r.width || r.height) {
      anchor = { x: r.left, y: r.top, bottom: r.bottom };
      anchorRange = range.cloneRange();
    }
  }
  lastText = raw;
  selected = money;
  from = money.currency;
  // Explicit requests for a home-currency price convert it into another currency.
  to = from === settings.target ? otherCurrency(from, settings) : settings.target;
  if (force || settings.mode !== 'prompt') {
    mount();
    panel(force);
  } else prompt(money);
}
document.addEventListener(
  'pointerup',
  (e) => {
    if (host && e.composedPath().includes(host)) return;
    if (e.button !== 0) return;
    lastAlt = e.altKey;
    anchor = { x: e.clientX, y: e.clientY, bottom: e.clientY };
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => void ready.then(() => capture()), 40);
  },
  true,
);
document.addEventListener(
  'keyup',
  (e) => {
    // Pages can dispatch a plain Event('keyup'), which has no KeyboardEvent.key.
    // Ignore malformed events before reading keyboard state or scheduling capture.
    if (typeof e.key !== 'string') return;
    if (host && e.composedPath().includes(host)) return;
    lastAlt = e.altKey;
    if (e.key === 'Shift' || e.key.startsWith('Arrow')) {
      clearTimeout(selectionTimer);
      selectionTimer = setTimeout(() => void ready.then(() => capture()), 40);
    }
  },
  true,
);
document.addEventListener(
  'pointerdown',
  (e) => {
    if (host && !e.composedPath().includes(host)) hide();
  },
  true,
);
document.addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Escape' && host) {
      hide();
      return;
    }
    if (e.key === 'Tab' && box) {
      const controls = box.querySelectorAll<HTMLElement>('button:not(:disabled),select,a');
      const first = controls[0],
        last = controls[controls.length - 1];
      const active = host?.shadowRoot?.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  },
  true,
);
// Keep the popup next to the selection while the page or an ancestor scrolls; close it
// once the selection leaves the viewport. Unrelated scrollers, such as carousels, leave it alone.
function follow() {
  followFrame = 0;
  if (!host) return;
  const r = anchorRange?.getBoundingClientRect();
  if (!r || (!r.width && !r.height) || r.bottom < 0 || r.top > innerHeight) {
    hide();
    return;
  }
  anchor = { x: r.left, y: r.top, bottom: r.bottom };
  position();
}
function scheduleFollow() {
  if (host && !followFrame) followFrame = requestAnimationFrame(follow);
}
document.addEventListener(
  'scroll',
  (e) => {
    if (host && !e.composedPath().includes(host)) scheduleFollow();
  },
  { capture: true, passive: true },
);
window.addEventListener('resize', scheduleFollow, { passive: true });
api.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.type === 'convertSelection') void ready.then(() => capture(true, message.text));
  // The toolbar popup asks the top frame which site it is on, to offer pausing it there.
  else if (message?.type === 'siteInfo' && window === window.top)
    reply({ host: location.host, protocol: location.protocol });
});
