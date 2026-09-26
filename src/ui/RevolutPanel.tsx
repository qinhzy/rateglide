import { t } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { rpc } from '../core/client';
import { parseAmount } from '../core/parser';
import type { RevolutQuote } from '../core/types';
import { formatAmount, formatRate } from '../data/currencies';
import { ErrorBox, IconButton, Loading, timeLabel, type ConvertState } from './shared';
export function RevolutPanel({ value }: { value: ConvertState }) {
  const [country, setCountry] = useState('GB'),
    [quote, setQuote] = useState<RevolutQuote | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [rev, setRev] = useState(0);
  const seq = useRef(0);
  const amount = parseAmount(value.amount);
  useEffect(() => {
    const id = ++seq.current;
    setQuote(null);
    setError('');
    if (amount === null || amount <= 0 || amount > 1e8 || value.from === value.to) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      rpc<RevolutQuote>({ type: 'revolut', from: value.from, to: value.to, amount, country })
        .then((r) => {
          if (seq.current === id) setQuote(r);
        })
        .catch((e) => {
          if (seq.current === id) setError(e.message);
        })
        .finally(() => {
          if (seq.current === id) setLoading(false);
        });
    }, 400);
    return () => {
      seq.current++;
      clearTimeout(timer);
    };
  }, [value.from, value.to, amount, country, rev]);
  return (
    <section className="revolut-panel">
      <div className="section-heading">
        <b>{t('Revolut · 换币报价')}</b>
        <IconButton
          label={t('刷新 Revolut 报价')}
          onClick={() => setRev((n) => n + 1)}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
        </IconButton>
      </div>
      <label className="revolut-region">
        {t('账户地区')}
        <select
          aria-label={t('Revolut 账户地区')}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        >
          {[
            ['GB', '英国'],
            ['US', '美国'],
            ['SG', '新加坡'],
            ['AU', '澳大利亚'],
            ['DE', '德国'],
            ['FR', '法国'],
            ['IE', '爱尔兰'],
            ['ES', '西班牙'],
            ['CH', '瑞士'],
            ['JP', '日本'],
          ].map(([c, n]) => (
            <option value={c} key={c}>
              {t(n)}
            </option>
          ))}
        </select>
      </label>
      {loading ? (
        <Loading label={t('获取 Revolut 公开报价…')} />
      ) : error ? (
        <ErrorBox message={error} onRetry={() => setRev((n) => n + 1)} />
      ) : quote ? (
        <>
          <div className="revolut-result">
            <span>{t('换币所得')}</span>
            <strong>
              {formatAmount(quote.received, quote.to)} <small>{quote.to}</small>
            </strong>
          </div>
          <p className="notice">
            1 {quote.from} = {formatRate(quote.rate)} {quote.to} · {timeLabel(quote.asOf)}
            {Date.now() - quote.asOf > 300000 ? t(' · 报价已超过 5 分钟') : ''}
          </p>
          <div className="revolut-plans">
            {quote.plans.map((p) => (
              <div key={p.id}>
                <b>{p.name}</b>
                <span>
                  {t('费用')} {formatAmount(p.fee, quote.from)} {quote.from}
                </span>
                <span>
                  {t('总支出')} {formatAmount(p.cost, quote.from)} {quote.from}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="notice">{t('请选择不同币种并输入有效金额。')}</p>
      )}
      <p className="notice">
        {t(
          '直接取自 Revolut 公开计算器。这里是换币报价，未包含后续汇款、套餐订阅或账户专属条件；与下方汇款到账报价分开列出。',
        )}
      </p>
    </section>
  );
}
