import css from './style.css';
import { t, setLanguage, getLanguage, getLocale } from '../i18n';
import { parseMoney, priceBeside, type PageContext } from '../core/parser';
import type { MarketTable } from '../core/providers';
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
  lastRange: Range | null = null,
  lastAlt = false;
let from = '',
  to = '';
let current: Quote | null = null;
// Refreshes of a provisional daily reference while a slow Wise request finishes.
let polls = 0;
// Hover mode: the prompt came from resting the pointer on a price rather than a selection.
let hovering = false,
  hoverTimer: ReturnType<typeof setTimeout> | undefined,
  leaveTimer: ReturnType<typeof setTimeout> | undefined;
const paths: Record<string, string> = {
  logo: 'M3 5h4l10 14h4 M17 15l4 4-4 2 M3 19h4L17 5h4 M17 2l4 3-4 4',
  close: 'M6 6l12 12 M6 18L18 6',
  copy: 'M9 9h11v12H9z M5 16H3V3h12v2',
  compare: 'M4 18V9 M10 18V4 M16 18v-7 M2 21h19',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  chevron: 'M6 9l6 6 6-6',
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
// The toolbar badge shows OFF while selection is paused on this site.
function reportSite() {
  try {
    if (window !== window.top) return;
    api.runtime
      .sendMessage({ type: 'siteState', paused: siteBlocked(location.host, settings.blockedSites) })
      .catch(() => {});
  } catch {
    // The extension context is gone after an update; the badge resets on navigation.
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
void ready.then(reportSite);
api.storage.onChanged.addListener((changes) => {
  if (changes.settings?.newValue) {
    const oldLanguage = settings.language;
    settings = { ...DEFAULTS, ...changes.settings.newValue };
    setLanguage(settings.language);
    if (oldLanguage !== settings.language || (hovering && settings.mode !== 'hover')) hide();
    if (!settings.enabled || siteBlocked(location.host, settings.blockedSites)) hide();
    else if (wrap) wrap.dataset.theme = settings.theme;
    reportSite();
  }
});
function hide() {
  clearTimeout(selectionTimer);
  clearTimeout(hoverTimer);
  clearTimeout(leaveTimer);
  requestId++;
  host?.remove();
  host = null;
  wrap = null;
  box = null;
  selected = null;
  current = null;
  anchorRange = null;
  hovering = false;
  lastText = '';
  lastRange = null;
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
  mark.setAttribute('aria-hidden', 'true');
  // The visible code and name truncate cleanly; a transparent native select on top keeps
  // keyboard type-ahead and the browser's own list.
  const code = el('b', 'code'),
    name = el('span', 'name');
  const show = (v: string) => {
    mark.textContent = flag(v);
    code.textContent = v;
    name.textContent = currencyName(v);
  };
  show(value);
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
    show(s.value);
    change(s.value);
  });
  const caret = icon('chevron');
  caret.classList.add('caret');
  field.append(mark, code, name, caret, s);
  return field;
}
function panel(focus = false) {
  if (!selected) return;
  if (!wrap) mount();
  clearTimeout(leaveTimer);
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
/** Loads the rate; a refresh keeps the shown result until the newer quote arrives. */
async function load(refresh = false) {
  const id = ++requestId;
  if (!box || !selected) return;
  const output = box.querySelector<HTMLElement>('[data-result]')!,
    detail = box.querySelector<HTMLElement>('[data-detail]')!,
    copyButton = box.querySelector<HTMLButtonElement>('.action-copy')!;
  if (!refresh) {
    current = null;
    polls = 0;
    output.textContent = t('正在换算…');
    detail.replaceChildren();
    copyButton.disabled = true;
  }
  box.querySelector('.original')!.textContent = `${formatAmount(selected.amount, from)} ${from} ≈`;
  try {
    const q = await rpc<Quote>({ type: 'quote', from, to, source: settings.source });
    if (id !== requestId || !box || !selected) return;
    current = q;
    output.textContent = `${formatAmount(selected.amount * q.rate, to)} ${to}`;
    output.style.fontSize = output.textContent.length > 21 ? '23px' : '30px';
    detail.replaceChildren(
      el(
        'div',
        'rate',
        from === to
          ? `1 ${from} = 1 ${to}`
          : `1 ${from} = ${formatRate(q.rate)} ${to} · 1 ${to} = ${formatRate(1 / q.rate)} ${from}`,
      ),
    );
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
    if (q.notice)
      detail.append(el('div', 'notice ' + (q.stale || q.provisional ? 'warning' : ''), q.notice));
    const others = el('div', 'others');
    detail.append(others);
    copyButton.disabled = false;
    void showOthers(id, others);
    if (q.provisional && polls < 5) {
      polls++;
      setTimeout(() => {
        if (id === requestId) void load(true);
      }, 1500);
    }
  } catch (e) {
    // A failed refresh keeps the provisional result already on screen.
    if (id !== requestId || !box || (refresh && current)) return;
    output.textContent = t('暂时无法换算');
    detail.replaceChildren(el('div', 'notice warning', (e as Error).message));
    const retry = el('button', 'retry', '重新获取');
    retry.addEventListener('click', () => void load());
    detail.append(retry);
  }
  position();
}
/** The same amount in the home currency and the watchlist, from the daily reference table. */
async function showOthers(id: number, list: HTMLElement) {
  if (!selected) return;
  const codes = [...new Set([settings.target, ...settings.favorites])]
    .filter((c) => c !== from && c !== to)
    .slice(0, 3);
  if (!codes.length) return;
  const amount = selected.amount;
  try {
    const table = await rpc<MarketTable>({ type: 'market' });
    if (id !== requestId || !table.rates[from]) return;
    const chips = codes
      .filter((code) => table.rates[code])
      .map((code) => {
        const value = (amount * table.rates[code]) / table.rates[from];
        const chip = el('button', 'other');
        chip.type = 'button';
        chip.textContent = `${formatAmount(value, code)} ${code}`;
        chip.title = t('改为换算成 {0}', [currencyName(code)]);
        chip.addEventListener('click', () => {
          to = code;
          panel();
        });
        return chip;
      });
    if (!chips.length) return;
    const label = el('span', 'others-label', '关注币种 · 每日参考');
    list.replaceChildren(label, ...chips);
    position();
  } catch {
    // The glance is optional; the main result already stands on its own.
  }
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
const inline = new Set(
  'A ABBR B BDI BDO CITE CODE DATA DEL DFN EM FONT I INS KBD LABEL MARK Q S SAMP SMALL SPAN STRONG SUB SUP TIME U VAR'.split(
    ' ',
  ),
);
function block(node: Node) {
  let elem = node.parentElement;
  while (elem && inline.has(elem.tagName) && elem.parentElement) elem = elem.parentElement;
  return elem ?? document.documentElement;
}
/** Up to `limit` characters of text from a node's subtree, without serializing all of it. */
function textOf(root: Node, limit: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let text = '';
  while (text.length < limit && walker.nextNode()) text += (walker.currentNode as Text).data;
  return text.slice(0, limit);
}
/** The characters just before and after a range within its block, such as the “$” of “$129”. */
function beside(range: Range, limit = 12) {
  const read = (node: Node, offset: number, forward: boolean) => {
    if (!(node instanceof Text)) return '';
    let text = forward ? node.data.slice(offset) : node.data.slice(0, offset);
    const walker = document.createTreeWalker(block(node), NodeFilter.SHOW_TEXT);
    walker.currentNode = node;
    while (text.length < limit) {
      const next = (forward ? walker.nextNode() : walker.previousNode()) as Text | null;
      if (!next) break;
      if (next.parentElement?.closest('script,style,noscript')) continue;
      text = forward ? text + next.data : next.data + text;
    }
    return forward ? text.slice(0, limit) : text.slice(-limit);
  };
  return {
    before: read(range.startContainer, range.startOffset, false),
    after: read(range.endContainer, range.endOffset, true),
  };
}
// The language a price is written in, from the page markup or, when that is missing or a
// generic default, from the script of the nearby text and the page title.
function pageContext(node: Node | null): PageContext {
  const elem = node instanceof Element ? node : (node?.parentElement ?? null);
  const declared = elem?.closest('[lang]')?.getAttribute('lang')?.trim() ?? '';
  // The closest text with a few letters describes the price; unrelated sections further up
  // the page, such as a Japanese paragraph on a Chinese page, must not decide it.
  let nearby = '';
  for (let e = elem, depth = 0; e && depth < 4; e = e.parentElement, depth++) {
    nearby = textOf(e, 300).replace(/[^\p{L}]/gu, '');
    if (nearby.length >= 4) break;
  }
  const script = (text: string) =>
    /[\u3040-\u30ff]/.test(text)
      ? 'ja'
      : /[\uac00-\ud7af]/.test(text)
        ? 'ko'
        : /[\u4e00-\u9fff]/.test(text)
          ? 'zh'
          : '';
  const title = script(document.title.slice(0, 200));
  let written = script(nearby);
  // Kanji-only labels such as “税込価格” are Japanese when the page title has kana.
  if (!written || (written === 'zh' && title === 'ja')) written = title || written;
  const primary = declared.toLowerCase().split(/[-_]/)[0];
  // Kana and Hangul settle the language; Han characters alone could still be Japanese.
  const overrides =
    written && (written === 'zh' ? !['zh', 'ja'].includes(primary) : primary !== written);
  return { lang: overrides ? written : declared, host: location.hostname };
}
// “$129<sup>99</sup>” is read as “$12999” by the selection; restore its decimal point.
function selectionText(selection: Selection | null, range: Range | null) {
  const text = selection?.toString() ?? '';
  if (!range || text.length > 120) return text;
  const fragment = range.cloneContents();
  if (!fragment.querySelector('sup')) return text;
  let plain = '',
    fixed = '';
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const cents = node.parentElement?.closest('sup') && /^\d{2}$/.test(node.data.trim());
    if (cents && /\d$/.test(fixed)) {
      const whole = fixed.match(/[\d.,'’\s]*$/)![0];
      fixed += (whole.includes('.') ? ',' : '.') + node.data.trim();
    } else fixed += node.data;
    plain += node.data;
  }
  // Trust the rebuilt text only when it is the same characters as the selection.
  return plain.replace(/\s+/g, '') === text.replace(/\s+/g, '') ? fixed : text;
}
/** A price from selected text, using the currency beside a bare number when it is outside. */
function readPrice(raw: string, range: Range | null, context: PageContext) {
  const strict = { ...settings, numbersOnly: false };
  const read = (text: string) => parseMoney(text, strict, context);
  const direct = read(raw);
  if (direct) return direct;
  if (range) {
    const { before, after } = beside(range);
    const money = priceBeside(raw, before, after, read);
    if (money) return money;
  }
  return settings.numbersOnly ? parseMoney(raw, settings, context) : null;
}
function sameRange(a: Range | null, b: Range | null) {
  return (
    !!a &&
    !!b &&
    a.startContainer === b.startContainer &&
    a.startOffset === b.startOffset &&
    a.endContainer === b.endContainer &&
    a.endOffset === b.endOffset
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
  const range = s?.rangeCount ? s.getRangeAt(0) : null;
  const selection = selectionText(s, range).trim();
  const plain = (s?.toString() ?? '').replace(/\s+/g, ' ').trim();
  // The context menu passes its own copy of the selection; prefer the rebuilt one when they match.
  const fromSelection = text === undefined || text.replace(/\s+/g, ' ').trim() === plain;
  const raw = fromSelection ? selection : text!.trim();
  if (!raw || (!force && raw === lastText && sameRange(range, lastRange))) return;
  if (host && s?.anchorNode && host.shadowRoot?.contains(s.anchorNode)) return;
  const money = readPrice(
    raw,
    fromSelection ? range : null,
    settings.smartSymbols ? pageContext(range?.startContainer ?? s?.anchorNode ?? null) : {},
  );
  // A price already in the home currency needs no prompt; the context menu and shortcut still work.
  if (!money || (!force && money.currency === settings.target)) {
    hide();
    return;
  }
  anchorRange = null;
  if (range) {
    const r = range.getBoundingClientRect();
    if (r.width || r.height) {
      anchor = { x: r.left, y: r.top, bottom: r.bottom };
      anchorRange = range.cloneRange();
    }
  }
  lastText = raw;
  lastRange = range?.cloneRange() ?? null;
  hovering = false;
  selected = money;
  from = money.currency;
  // Explicit requests for a home-currency price convert it into another currency.
  to = from === settings.target ? otherCurrency(from, settings) : settings.target;
  if (force || (settings.mode !== 'prompt' && settings.mode !== 'hover')) {
    mount();
    panel(force);
  } else prompt(money);
}
/** The text position under the pointer, in browsers with either caret API. */
function caretAt(x: number, y: number): { node: Text; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const position = doc.caretPositionFromPoint?.(x, y);
  if (position)
    return position.offsetNode instanceof Text
      ? { node: position.offsetNode, offset: position.offset }
      : null;
  const range = doc.caretRangeFromPoint?.(x, y);
  return range?.startContainer instanceof Text
    ? { node: range.startContainer, offset: range.startOffset }
    : null;
}
function hoverAt(x: number, y: number) {
  // An open panel or a prompt from a selection stays put; a leftover page selection does not
  // switch hovering off once its prompt is gone.
  if (
    settings.mode !== 'hover' ||
    !settings.enabled ||
    siteBlocked(location.host, settings.blockedSites) ||
    box ||
    (host && !hovering)
  )
    return;
  const caret = caretAt(x, y);
  if (!caret || editable(caret.node) || (host && host.contains(caret.node))) return;
  for (const match of caret.node.data.matchAll(/\d(?:[\d.,'’\u00a0\u202f ]*\d)?/g)) {
    const start = match.index!,
      end = start + match[0].length;
    if (caret.offset < start - 4 || caret.offset > end + 4) continue;
    const range = document.createRange();
    range.setStart(caret.node, start);
    range.setEnd(caret.node, end);
    const r = range.getBoundingClientRect();
    // Caret APIs snap to the nearest text, so require the pointer to be over the number.
    if (x < r.left - 16 || x > r.right + 16 || y < r.top - 4 || y > r.bottom + 4) return;
    if (hovering && sameRange(range, anchorRange)) return;
    const money = readPrice(match[0], range, settings.smartSymbols ? pageContext(caret.node) : {});
    if (!money || money.currency === settings.target) return;
    lastText = '';
    hovering = true;
    anchorRange = range;
    anchor = { x: r.left, y: r.top, bottom: r.bottom };
    from = money.currency;
    to = settings.target;
    prompt(money);
    return;
  }
}
function inside(x: number, y: number, r: DOMRect | undefined, margin: number) {
  return (
    !!r &&
    x >= r.left - margin &&
    x <= r.right + margin &&
    y >= r.top - margin &&
    y <= r.bottom + margin
  );
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
  'pointermove',
  (e) => {
    if (settings.mode !== 'hover' || e.pointerType === 'touch' || e.buttons) return;
    if (host && e.composedPath().includes(host)) {
      clearTimeout(leaveTimer);
      return;
    }
    const { clientX: x, clientY: y } = e;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => void ready.then(() => hoverAt(x, y)), 450);
    // A hover prompt that has not been opened leaves with the pointer.
    if (hovering && !box) {
      clearTimeout(leaveTimer);
      if (
        !inside(x, y, anchorRange?.getBoundingClientRect(), 12) &&
        !inside(x, y, wrap?.getBoundingClientRect(), 8)
      )
        leaveTimer = setTimeout(() => {
          if (hovering && !box) hide();
        }, 350);
    }
  },
  { capture: true, passive: true },
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
  if (
    !r ||
    (!r.width && !r.height) ||
    r.bottom < 0 ||
    r.top > innerHeight ||
    r.right < 0 ||
    r.left > innerWidth
  ) {
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
