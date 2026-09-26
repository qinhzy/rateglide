import { t } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { RevolutPanel } from './RevolutPanel';
import { rpc } from '../core/client';
import { formatAmount, formatRate } from '../data/currencies';
import { countries, directory } from '../data/directory';
import type { CompareRow, Quote } from '../core/types';
import {
  CurrencyPicker,
  ErrorBox,
  External,
  IconButton,
  Loading,
  timeLabel,
  usePricePaste,
  type ConvertState,
} from './shared';
import { parseAmount } from '../core/parser';
export function Comparison({
  value,
  setValue,
  onBack,
  provider,
}: {
  value: ConvertState;
  setValue: (v: ConvertState) => void;
  onBack: () => void;
  provider?: string;
}) {
  const [rows, setRows] = useState<CompareRow[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [sourceCountry, setSourceCountry] = useState(''),
    [targetCountry, setTargetCountry] = useState(''),
    [filters, setFilters] = useState(false),
    [revision, setRevision] = useState(0),
    [refs, setRefs] = useState<Quote[]>([]),
    [filter, setFilter] = useState('全部');
  const serial = useRef(0);
  const amount = parseAmount(value.amount);
  const onPaste = usePricePaste(value, setValue);
  useEffect(() => {
    const id = ++serial.current;
    setRows([]);
    setRefs([]);
    setError('');
    if (amount === null || amount <= 0 || amount > 1e8 || value.from === value.to) {
      setLoading(false);
      setError('请输入大于 0、不超过 1 亿的金额，并选择不同币种');
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      rpc<CompareRow[]>({
        type: 'compare',
        from: value.from,
        to: value.to,
        amount,
        sourceCountry,
        targetCountry,
      })
        .then((r) => {
          if (id === serial.current) setRows(r);
        })
        .catch((e) => {
          if (id === serial.current) setError(e.message);
        })
        .finally(() => {
          if (id === serial.current) setLoading(false);
        });
      Promise.allSettled(
        ['wise', 'boc', 'market'].map((source) =>
          rpc<Quote>({ type: 'quote', from: value.from, to: value.to, source }),
        ),
      ).then((results) => {
        if (id === serial.current)
          setRefs(results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])));
      });
    }, 350);
    return () => {
      clearTimeout(timer);
      serial.current++;
    };
  }, [value.from, value.to, amount, sourceCountry, targetCountry, revision]);
  const filtered = rows
    .filter((r) => !provider || r.name.toLowerCase().startsWith(provider.toLowerCase()))
    .filter((r) => filter === '全部' || r.type === filter);
  return (
    <section className="comparison">
      <div className="section-heading">
        <IconButton label={t('返回换算')} onClick={onBack}>
          <ArrowLeft size={18} />
        </IconButton>
        <h2>{t('这笔兑换，实际能收到多少')}</h2>
        <IconButton
          label={t('刷新比价')}
          onClick={() => setRevision((x) => x + 1)}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </IconButton>
      </div>
      <div className="compare-input">
        <input
          aria-label={t('比价金额')}
          inputMode="decimal"
          maxLength={40}
          value={value.amount}
          onChange={(e) => setValue({ ...value, amount: e.target.value })}
          onPaste={onPaste}
        />
        <CurrencyPicker
          label={t('比价原币种')}
          value={value.from}
          onChange={(from) => setValue({ ...value, from })}
        />
        <span>→</span>
        <CurrencyPicker
          label={t('比价目标币种')}
          value={value.to}
          onChange={(to) => setValue({ ...value, to })}
        />
      </div>
      <div className="filter-row">
        <div className="mini-tabs">
          {['全部', '汇款平台', '银行'].map((f) => (
            <button className={f === filter ? 'active' : ''} onClick={() => setFilter(f)} key={f}>
              {t(f)}
            </button>
          ))}
        </div>
        <button
          className="text-button"
          onClick={() => setFilters(!filters)}
          aria-expanded={filters}
        >
          <SlidersHorizontal size={14} />
          {t('地区')}
        </button>
      </div>
      {filters ? (
        <div className="country-filters">
          {[
            [sourceCountry, setSourceCountry, '汇出地区'],
            [targetCountry, setTargetCountry, '收款地区'],
          ].map(([val, set, label]) => (
            <label key={String(label)}>
              {t(String(label))}
              <select
                value={val as string}
                onChange={(e) => (set as (x: string) => void)(e.target.value)}
              >
                {countries.map(([c, n]) => (
                  <option key={c} value={c}>
                    {t(n)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}
      {!provider ? <RevolutPanel value={value} /> : null}
      <p className="comparison-note">
        {t('按预计到账排序 · 银行转账 → 银行账户')}
        <br />
        {t('Wise 采集的第三方报价估算，非保证成交价。')}
      </p>
      {loading ? (
        <Loading label={t('正在比较平台费用与到账金额…')} />
      ) : error ? (
        <ErrorBox message={error} onRetry={() => setRevision((x) => x + 1)} />
      ) : filtered.length ? (
        <div className="quote-list">
          {filtered.map((r, i) => (
            <article className="compare-row" key={r.id}>
              <div className="provider-line">
                <div className={'provider-monogram ' + (r.name === 'Wise' ? 'wise' : '')}>
                  {r.name.slice(0, 1)}
                </div>
                <div className="provider-title">
                  <b>{r.name}</b>
                  <small>
                    {r.sourceCountry || t('未指定')} → {r.targetCountry || t('未指定')} ·{' '}
                    {timeLabel(r.collectedAt)}
                  </small>
                </div>
                <div className="received">
                  <strong>{formatAmount(r.received, value.to)}</strong>
                  <small>
                    {value.to}
                    {t('· 预计到账')}
                  </small>
                </div>
              </div>
              <div className="quote-details">
                <span>
                  {t('汇率')} {formatRate(r.rate)}
                </span>
                <span>
                  {t('手续费')} {formatAmount(r.fee, value.from)} {value.from}
                </span>
              </div>
              {Date.now() - r.collectedAt > 86400000 ? (
                <p className="warning notice">
                  {t('采集数据已超过 24 小时，此处显示的是历史采集结果。')}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">
          <b>{t('此路线暂无{0}报价', [t(filter === '全部' ? '公开' : filter)])}</b>
          <p>{t('请更换币种或地区；暂无报价时不会用中间价代替。')}</p>
          <button
            className="text-button"
            onClick={() => {
              setValue({ amount: '1000', from: 'GBP', to: 'EUR' });
              setSourceCountry('');
              setTargetCountry('');
              setFilter('全部');
            }}
          >
            {t('查看 GBP → EUR 路线')}
          </button>
        </div>
      )}
      {!loading && rows.length ? (
        <div className="comparison-footer">
          <span>{t('{0} 组报价 · 各地区分别列出', [rows.length])}</span>
        </div>
      ) : null}
      {refs.length ? (
        <div className="reference-section">
          <h3>{t('参考价，另行比较')}</h3>
          <p>{t('下列金额未扣费用，不能与上方预计到账直接排名。')}</p>
          {refs.map((q) => (
            <div className="reference-row" key={q.source}>
              <span>
                {t(q.label)}
                <small>
                  {t(q.kind)}
                  {q.stale ? t(' · 过期缓存') : ''}
                </small>
              </span>
              <div>
                <b>{amount !== null ? formatAmount(q.rate * amount, value.to) : '—'}</b>
                <small>{timeLabel(q.asOf)}</small>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <p className="notice">
        {t('金额、货币对和所选地区会发送给对应报价来源。不会读取你的银行账户，也不会执行汇款。')}
      </p>
    </section>
  );
}
