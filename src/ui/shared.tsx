import { t, getLanguage, getLocale, type LanguagePreference } from '../i18n';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type ReactNode,
} from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Search,
  Shuffle,
  X,
  LoaderCircle,
  RefreshCw,
  Info,
  Languages,
} from 'lucide-react';
import {
  currencies,
  currencyCodes,
  currencyName,
  currencyRegion,
  flag,
  searchCurrencies,
} from '../data/currencies';
import { parseAmount, parseMoney } from '../core/parser';
import { DEFAULTS, type Quote, type Settings } from '../core/types';
export type ConvertState = { amount: string; from: string; to: string };
/** Current preferences, so nested controls can use the home currency and watchlist. */
export const SettingsContext = createContext<Settings | null>(null);
export function Brand() {
  return (
    <div className="brand">
      <Shuffle aria-hidden="true" />
      <div>
        <b>RateGlide</b>
        <span>{getLanguage() === 'zh-CN' ? '汇见 · 随手换算' : 'CURRENCY AT YOUR CURSOR'}</span>
      </div>
    </div>
  );
}
export function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  className = '',
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={'icon-button ' + className}
      title={t(label)}
      aria-label={t(label)}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function CurrencyPicker({
  value,
  onChange,
  label = '选择币种',
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const settings = useContext(SettingsContext);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(''),
    [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    list = useRef<HTMLDivElement>(null);
  const id = useId();
  // The current value, home currency and watchlist come first; searches rank by relevance.
  const frequent = useMemo(
    () =>
      [...new Set([value, settings?.target ?? '', ...(settings?.favorites ?? [])])].filter((c) =>
        currencyCodes.has(c),
      ),
    [value, settings?.target, settings?.favorites],
  );
  const matches = useMemo(() => searchCurrencies(query, frequent), [query, frequent]);
  const groups: [string, string[]][] = query.trim()
    ? [['', matches]]
    : [
        ['常用', frequent],
        ['全部币种', currencies.map((c) => c.code)],
      ];
  const options = groups.flatMap(([, codes]) => codes);
  useEffect(() => {
    if (!open) return;
    function close(e: Event) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  useEffect(() => {
    if (open)
      list.current
        ?.querySelector(`[data-index="${active}"]`)
        ?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, query]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function choose(code: string) {
    onChange(code);
    close();
  }
  let offset = 0;
  return (
    <div className="currency-picker" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="currency-trigger"
        aria-label={t(label)}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          setQuery('');
          setActive(0);
        }}
      >
        <span className="flag" aria-hidden="true">
          {flag(value)}
        </span>
        <b>{value}</b>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div
          className="currency-menu"
          role="dialog"
          aria-label={t(label)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
            if (e.key === 'Tab') {
              const items = e.currentTarget.querySelectorAll<HTMLElement>('input,button');
              const first = items[0],
                last = items[items.length - 1];
              if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              } else if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
              }
            }
          }}
        >
          <div className="search-field">
            <Search size={16} aria-hidden="true" />
            <input
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-autocomplete="list"
              aria-controls={id + '-list'}
              aria-activedescendant={options.length ? `${id}-${active}` : undefined}
              placeholder={t('搜索币种、国家或代码')}
              aria-label={t('搜索币种')}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const step = e.key === 'ArrowDown' ? 1 : -1;
                  setActive((i) => Math.max(0, Math.min(options.length - 1, i + step)));
                } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (options[active]) choose(options[active]);
                }
              }}
            />
            <IconButton label={t('关闭币种搜索')} onClick={close}>
              <X size={15} />
            </IconButton>
          </div>
          <div className="currency-results" id={id + '-list'} role="listbox" ref={list}>
            {options.length ? (
              groups.map(([title, codes]) => {
                const start = offset;
                offset += codes.length;
                return (
                  <div role="group" aria-label={title ? t(title) : undefined} key={title}>
                    {title ? (
                      <div className="currency-group" aria-hidden="true">
                        {t(title)}
                      </div>
                    ) : null}
                    {codes.map((code, i) => (
                      <div
                        key={code}
                        id={`${id}-${start + i}`}
                        data-index={start + i}
                        role="option"
                        aria-selected={start + i === active}
                        className="currency-option"
                        onMouseMove={() => {
                          if (active !== start + i) setActive(start + i);
                        }}
                        onClick={() => choose(code)}
                      >
                        <span className="flag" aria-hidden="true">
                          {flag(code)}
                        </span>
                        <span>
                          {currencyName(code)}
                          <small>
                            {getLanguage() === 'zh-CN'
                              ? currencies.find((c) => c.code === code)?.en
                              : currencyRegion(code) || code}
                          </small>
                        </span>
                        <b>{code}</b>
                        {code === value ? <Check size={15} aria-hidden="true" /> : null}
                      </div>
                    ))}
                  </div>
                );
              })
            ) : (
              <p className="empty">{t('没有找到币种，试试 USD 或 美元')}</p>
            )}
          </div>
          <div className="menu-note">
            {query.trim()
              ? t('{0} 个匹配 · ↑↓ 选择，Enter 确认', [matches.length])
              : t('{0} 个币种代码 · 覆盖范围因数据源而异', [currencies.length])}
          </div>
        </div>
      ) : null}
    </div>
  );
}
/** Paste a price such as “€ 1.234,56” into an amount field to fill both amount and currency. */
export function usePricePaste(value: ConvertState, setValue: (v: ConvertState) => void) {
  const settings = useContext(SettingsContext);
  return (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text/plain').trim();
    if (!text || parseAmount(text) !== null) return;
    const money = parseMoney(text, { ...(settings ?? DEFAULTS), numbersOnly: false });
    if (!money) return;
    e.preventDefault();
    setValue({
      amount: String(money.amount),
      from: money.currency,
      to: money.currency === value.to ? value.from : value.to,
    });
  };
}
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="toggle"
      role="switch"
      aria-checked={checked}
      aria-label={t(label)}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}
export function Loading({ label = '正在获取最新汇率…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={18} className="spin" />
      {t(label)}
    </div>
  );
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-box" role="alert">
      <Info size={17} />
      <span>{t(message)}</span>
      {onRetry ? (
        <IconButton label={t('重新获取')} onClick={onRetry}>
          <RefreshCw size={16} />
        </IconButton>
      ) : null}
    </div>
  );
}
export function timeLabel(ms: number, dateOnly = false) {
  return new Intl.DateTimeFormat(getLocale(), {
    month: '2-digit',
    day: '2-digit',
    ...(!dateOnly ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(ms);
}
export function SourceMeta({ quote }: { quote: Quote }) {
  return (
    <div className="source-meta">
      <span title={t(quote.notice || '')}>
        {t(quote.label)} · {t(quote.kind)}
        <Info size={12} />
      </span>
      <time
        dateTime={new Date(quote.asOf).toISOString()}
        title={t('来源时间：') + new Date(quote.asOf).toLocaleString(getLocale())}
      >
        {quote.stale ? t('过期缓存 · ') : quote.cached ? t('缓存 · ') : ''}
        {timeLabel(quote.asOf, quote.source === 'ecb')}
      </time>
    </div>
  );
}
export function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight size={15} />
    </a>
  );
}

export function LanguagePicker({
  value,
  onChange,
  compact = false,
}: {
  value: LanguagePreference;
  onChange: (language: LanguagePreference) => void;
  compact?: boolean;
}) {
  return (
    <label className={'language-picker ' + (compact ? 'compact' : '')} title={t('界面语言')}>
      <Languages size={16} aria-hidden="true" />
      <select
        aria-label={t('界面语言')}
        value={value}
        onChange={(e) => onChange(e.target.value as LanguagePreference)}
      >
        <option value="system">
          {compact ? (getLanguage() === 'en' ? 'Auto' : '自动') : t('跟随浏览器')}
        </option>
        <option value="zh-CN">{compact ? '中文' : '简体中文'}</option>
        <option value="en">{compact ? 'EN' : 'English'}</option>
      </select>
    </label>
  );
}
