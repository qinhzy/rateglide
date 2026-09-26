import { t } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpDown, Check, Copy, RefreshCw, Star } from 'lucide-react';
import { rpc } from '../core/client';
import { SOURCE_LABELS } from '../core/providers';
import { formatAmount, formatRate } from '../data/currencies';
import { parseAmount } from '../core/parser';
import type { Quote, Settings, Source } from '../core/types';
import {
  CurrencyPicker,
  ErrorBox,
  IconButton,
  Loading,
  SourceMeta,
  usePricePaste,
  type ConvertState,
} from './shared';
export type { ConvertState };
export function Converter({
  value,
  setValue,
  settings,
  onCompare,
  onFavorite,
  autoFocus = false,
}: {
  value: ConvertState;
  setValue: (v: ConvertState) => void;
  settings: Settings;
  onCompare: () => void;
  onFavorite: () => void;
  autoFocus?: boolean;
}) {
  const [quote, setQuote] = useState<Quote | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0),
    [copied, setCopied] = useState(false);
  const serial = useRef(0),
    input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source>(settings.source);
  const amount = parseAmount(value.amount);
  const onPaste = usePricePaste(value, setValue);
  useEffect(() => setSource(settings.source), [settings.source]);
  useEffect(() => {
    // Opening the toolbar popup lets you type a new amount straight away.
    if (autoFocus) input.current?.select();
  }, [autoFocus]);
  useEffect(() => {
    const id = ++serial.current;
    setLoading(true);
    setError('');
    setQuote(null);
    rpc<Quote>({ type: 'quote', from: value.from, to: value.to, source, force: revision > 0 })
      .then((q) => {
        if (id === serial.current) setQuote(q);
      })
      .catch((e) => {
        if (id === serial.current) setError(e.message);
      })
      .finally(() => {
        if (id === serial.current) setLoading(false);
      });
    return () => {
      serial.current++;
    };
  }, [value.from, value.to, source, revision]);
  const result = quote && amount !== null ? amount * quote.rate : null;
  async function copy() {
    if (result === null || !quote) return;
    try {
      await navigator.clipboard.writeText(`${formatAmount(result, value.to)} ${value.to}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      await rpc({
        type: 'addHistory',
        entry: { amount, from: value.from, to: value.to, result, source: quote.label },
      });
    } catch {
      setError('复制失败，请手动选中结果复制');
    }
  }
  return (
    <section className="converter">
      <div className="field-label">
        <label htmlFor="amount">{t('兑换金额')}</label>
        <IconButton
          label={settings.favorites.includes(value.from) ? '取消关注此币种' : '关注此币种'}
          onClick={onFavorite}
        >
          <Star
            size={15}
            fill={settings.favorites.includes(value.from) ? 'currentColor' : 'none'}
          />
        </IconButton>
      </div>
      <div className={'amount-field ' + (amount === null ? 'invalid' : '')}>
        <input
          ref={input}
          id="amount"
          aria-label={t('兑换金额')}
          aria-invalid={amount === null}
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          spellCheck={false}
          maxLength={50}
          value={value.amount}
          onChange={(e) => setValue({ ...value, amount: e.target.value })}
          onPaste={onPaste}
        />
        <CurrencyPicker
          label={t('原币种')}
          value={value.from}
          onChange={(from) => setValue({ ...value, from })}
        />
      </div>
      {amount === null ? (
        <p className="field-error">{t('请输入有效金额，例如 1,000.50、1.000,50 或 2.5k')}</p>
      ) : null}
      <div className="swap-line">
        <span>{t('约合')}</span>
        <IconButton
          label={t('交换币种')}
          onClick={() => setValue({ ...value, from: value.to, to: value.from })}
        >
          <ArrowUpDown size={18} />
        </IconButton>
      </div>
      <div className="amount-field result-field">
        <output
          aria-label={t('换算结果')}
          aria-live="polite"
          className={
            result !== null && formatAmount(result, value.to).length > 16 ? 'small-number' : ''
          }
        >
          {amount === null ? (
            '—'
          ) : loading ? (
            <span className="skeleton" />
          ) : result !== null ? (
            formatAmount(result, value.to)
          ) : (
            '—'
          )}
        </output>
        <CurrencyPicker
          label={t('目标币种')}
          value={value.to}
          onChange={(to) => setValue({ ...value, to })}
        />
      </div>
      <div className="rate-line">
        <span>
          {quote && !loading ? (
            <>
              1 {value.from} = {formatRate(quote.rate)} {value.to}
              {value.from !== value.to ? (
                <small className="inverse-rate">
                  1 {value.to} = {formatRate(1 / quote.rate)} {value.from}
                </small>
              ) : null}
            </>
          ) : (
            t('汇率会保留来源与更新时间')
          )}
        </span>
        <div>
          <IconButton
            label={copied ? '已复制' : '复制换算结果'}
            onClick={copy}
            disabled={result === null}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </IconButton>
          <IconButton
            label={t('刷新汇率')}
            onClick={() => setRevision((x) => x + 1)}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </IconButton>
        </div>
      </div>
      <div className="source-choice">
        <select
          aria-label={t('汇率来源')}
          value={source}
          onChange={(e) => setSource(e.target.value as Source)}
        >
          {Object.entries(SOURCE_LABELS).map(([v, l]) => (
            <option value={v} key={v}>
              {t(l)}
            </option>
          ))}
        </select>
      </div>
      {quote ? (
        <>
          <SourceMeta quote={quote} />
          {quote.stale || quote.source !== 'wise' ? (
            <p className={'notice ' + (quote.stale ? 'warning' : '')}>{t(quote.notice || '')}</p>
          ) : (
            <p className="notice">{t('中间价未含费用；实际到账金额可在比价中查看。')}</p>
          )}
        </>
      ) : loading ? (
        <Loading />
      ) : null}
      {error ? <ErrorBox message={error} onRetry={() => setRevision((x) => x + 1)} /> : null}
      <button
        className="primary"
        onClick={onCompare}
        disabled={amount === null || amount <= 0 || value.from === value.to}
      >
        {t('比较这笔兑换')}
        <ArrowRight size={17} />
      </button>
    </section>
  );
}
