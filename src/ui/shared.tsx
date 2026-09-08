import { t, getLanguage, getLocale, type LanguagePreference } from '../i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { currencies, currencyName, flag } from '../data/currencies';
import type { Quote } from '../core/types';
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={'brand ' + (small ? 'small' : '')}>
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
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const filtered = currencies.filter((c) =>
    `${c.code} ${c.name} ${c.en}`.toLowerCase().includes(query.toLowerCase()),
  );
  useEffect(() => {
    if (!open) return;
    function close(e: Event) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
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
              setOpen(false);
              trigger.current?.focus();
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
            <Search size={16} />
            <input
              autoFocus
              placeholder={t('搜索币种、国家或代码')}
              aria-label={t('搜索币种')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <IconButton
              label={t('关闭币种搜索')}
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <X size={15} />
            </IconButton>
          </div>
          <div className="currency-results">
            {filtered.length ? (
              filtered.map((c) => (
                <button
                  key={c.code}
                  className="currency-option"
                  onClick={() => {
                    onChange(c.code);
                    setOpen(false);
                    trigger.current?.focus();
                  }}
                >
                  <span className="flag">{c.flag}</span>
                  <span>
                    {currencyName(c.code)}
                    <small>{getLanguage() === 'zh-CN' ? c.en : c.code}</small>
                  </span>
                  <b>{c.code}</b>
                  {c.code === value ? <Check size={15} /> : null}
                </button>
              ))
            ) : (
              <p className="empty">{t('没有找到币种，试试 USD 或 美元')}</p>
            )}
          </div>
          <div className="menu-note">
            {t('{0} 个币种代码 · 覆盖范围因数据源而异', [currencies.length])}
          </div>
        </div>
      ) : null}
    </div>
  );
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
export function currencyLabel(code: string) {
  return `${currencyName(code)} ${code}`;
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
