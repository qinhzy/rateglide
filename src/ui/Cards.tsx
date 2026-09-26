import { t } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpDown, Check, Copy, CreditCard, RefreshCw } from 'lucide-react';
import { rpc } from '../core/client';
import { CARD_LABELS, today } from '../core/payments';
import { parseAmount, parseNumber } from '../core/parser';
import type { CardNetwork, CardQuote, Settings } from '../core/types';
import { formatAmount, formatRate } from '../data/currencies';
import {
  CurrencyPicker,
  ErrorBox,
  IconButton,
  Loading,
  usePricePaste,
  type ConvertState,
} from './shared';

export function Cards({
  value,
  setValue,
  settings,
  save,
}: {
  value: ConvertState;
  setValue: (v: ConvertState) => void;
  settings: Settings;
  save: (s: Partial<Settings>) => Promise<void>;
}) {
  const [date, setDate] = useState(''),
    [fee, setFee] = useState(String(settings.bankFee)),
    [revision, setRevision] = useState(0),
    [results, setResults] = useState<Partial<Record<CardNetwork, CardQuote>>>({}),
    [errors, setErrors] = useState<Partial<Record<CardNetwork, string>>>({}),
    [busy, setBusy] = useState<CardNetwork[]>([]),
    [copied, setCopied] = useState('');
  const serial = useRef(0),
    amount = parseAmount(value.amount),
    bankFee = parseNumber(fee);
  const onPaste = usePricePaste(value, setValue);
  const invalid =
    amount === null || amount <= 0 || amount > 1e8
      ? '交易金额应大于 0 且不超过 1 亿'
      : bankFee === null || bankFee < 0 || bankFee > 30
        ? '附加费应为 0% 到 30%'
        : null;
  useEffect(() => {
    const id = ++serial.current;
    setResults({});
    setErrors({});
    setBusy([]);
    if (invalid) return;
    const networks: CardNetwork[] = ['visa', 'mastercard'];
    setBusy(networks);
    const timer = setTimeout(() => {
      networks.forEach((network) => {
        rpc<CardQuote>({
          type: 'card',
          input: { network, from: value.from, to: value.to, amount, bankFee, date },
          force: revision > 0,
        })
          .then((q) => {
            if (serial.current === id) setResults((r) => ({ ...r, [network]: q }));
          })
          .catch((e) => {
            if (serial.current === id) setErrors((r) => ({ ...r, [network]: e.message }));
          })
          .finally(() => {
            if (serial.current === id) setBusy((b) => b.filter((n) => n !== network));
          });
      });
    }, 400);
    return () => {
      clearTimeout(timer);
      serial.current++;
    };
  }, [value.from, value.to, amount, bankFee, date, revision, invalid]);
  async function copy(q: CardQuote) {
    try {
      await navigator.clipboard.writeText(
        t('{0} {1} · {2} · {3} · 附加费 {4}%', [
          formatAmount(q.total, q.to),
          q.to,
          CARD_LABELS[q.network],
          q.rateDate,
          q.bankFee,
        ]),
      );
      setCopied(q.network);
      setTimeout(() => setCopied(''), 1600);
    } catch {
      setErrors((e) => ({ ...e, [q.network]: '复制失败，请手动选中账单金额复制' }));
    }
  }
  return (
    <section className="cards-view">
      <div className="section-heading">
        <CreditCard size={19} />
        <h2>{t('刷这张卡，会扣多少钱')}</h2>
        <IconButton
          label={t('刷新卡组织报价')}
          onClick={() => setRevision((n) => n + 1)}
          disabled={!!busy.length}
        >
          <RefreshCw size={16} className={busy.length ? 'spin' : ''} />
        </IconButton>
      </div>
      <p className="cards-intro">{t('直接查询 Visa 与 Mastercard 官方计算器报价')}</p>
      <div className="card-form">
        <label>
          {t('交易金额')}
          <input
            aria-label={t('刷卡交易金额')}
            inputMode="decimal"
            value={value.amount}
            maxLength={40}
            onChange={(e) => setValue({ ...value, amount: e.target.value })}
            onPaste={onPaste}
          />
        </label>
        <div className="card-currencies">
          <div>
            <span>{t('交易币种')}</span>
            <CurrencyPicker
              label={t('卡组织交易币种')}
              value={value.from}
              onChange={(from) => setValue({ ...value, from })}
            />
          </div>
          <IconButton
            label={t('交换刷卡币种')}
            onClick={() => setValue({ ...value, from: value.to, to: value.from })}
          >
            <ArrowUpDown size={17} />
          </IconButton>
          <div>
            <span>{t('账单币种')}</span>
            <CurrencyPicker
              label={t('卡组织账单币种')}
              value={value.to}
              onChange={(to) => setValue({ ...value, to })}
            />
          </div>
        </div>
        <div className="card-options">
          <label>
            {t('报价日期')}
            <select
              aria-label={t('刷卡日期模式')}
              value={date ? 'custom' : 'latest'}
              onChange={(e) => setDate(e.target.value === 'latest' ? '' : today())}
            >
              <option value="latest">{t('最新公布')}</option>
              <option value="custom">{t('指定日期')}</option>
            </select>
          </label>
          <label>
            {t('发卡行附加费 (%)')}
            <input
              aria-label={t('发卡行附加费')}
              inputMode="decimal"
              maxLength={6}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              onBlur={() => {
                if (bankFee !== null && bankFee >= 0 && bankFee <= 30) void save({ bankFee });
              }}
            />
          </label>
        </div>
        {date ? (
          <label className="date-field">
            {t('交易日期')}
            <input
              aria-label={t('刷卡交易日期')}
              type="date"
              max={today()}
              min={new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)}
              value={date}
              onChange={(e) => setDate(e.target.value || today())}
            />
          </label>
        ) : null}
      </div>
      {invalid ? (
        <ErrorBox message={invalid} />
      ) : (
        <div className="card-quotes">
          {(['visa', 'mastercard'] as CardNetwork[]).map((network) => {
            const q = results[network];
            return (
              <article
                className={'network-quote ' + network}
                key={network}
                data-network={network}
                data-fee={q?.bankFee}
                data-from={q?.from}
                data-to={q?.to}
                data-date={q?.date}
                data-amount={q?.amount}
              >
                <header>
                  <b className="network-brand">
                    {network === 'visa' ? (
                      'VISA'
                    ) : (
                      <>
                        <span className="mc-symbol" />
                        Mastercard
                      </>
                    )}
                  </b>
                  <span>{t('官方公布价')}</span>
                  {q ? (
                    <IconButton
                      label={
                        copied === network
                          ? '账单已复制'
                          : t('复制 {0} 账单', [CARD_LABELS[network]])
                      }
                      onClick={() => void copy(q)}
                    >
                      {copied === network ? <Check size={14} /> : <Copy size={14} />}
                    </IconButton>
                  ) : null}
                </header>
                {busy.includes(network) ? (
                  <Loading label={t('查询卡组织报价…')} />
                ) : q ? (
                  <>
                    <div className="network-total">
                      <span>{t('预计账单')}</span>
                      <output aria-label={t('{0} 预计账单', [CARD_LABELS[network]])}>
                        {formatAmount(q.total, q.to)} <small>{q.to}</small>
                      </output>
                    </div>
                    <div className="network-details">
                      <span>
                        {t('基础汇率')} <b>{formatRate(q.baseRate)}</b>
                      </span>
                      <span>
                        {t('附加费')}{' '}
                        <b>
                          {formatAmount(q.feeAmount, q.to)} {q.to}
                        </b>
                      </span>
                    </div>
                    <div className="network-date">
                      <time>{q.rateDate}</time>
                      <span>
                        {q.stale
                          ? t('请求失败 · 上次缓存')
                          : q.cached
                            ? t('缓存报价')
                            : t('已含 {0}% 附加费', [q.bankFee])}
                      </span>
                    </div>
                    {q.stale ? (
                      <p className="notice warning">
                        {t('无法更新，保留上次查询结果。不是最新报价。')}
                      </p>
                    ) : null}
                    {date && q.rateDate !== date ? (
                      <p className="notice warning">
                        {t('该日尚无新牌价，官方返回 {0} 的报价。', [q.rateDate])}
                      </p>
                    ) : null}
                  </>
                ) : null}
                {errors[network] ? (
                  <ErrorBox message={errors[network]!} onRetry={() => setRevision((n) => n + 1)} />
                ) : null}
              </article>
            );
          })}
        </div>
      )}
      {results.visa && results.mastercard ? (
        <p className="card-difference">
          {results.visa.rateDate !== results.mastercard.rateDate
            ? t('两家公布日期不同，已分别标明。')
            : t('相同交易条件，预计账单相差 {0} {1}。', [
                formatAmount(Math.abs(results.visa.total - results.mastercard.total), value.to),
                value.to,
              ])}
        </p>
      ) : null}
      <details className="inline-info">
        <summary>{t('关于入账日期与费用')}</summary>
        <p>
          {t(
            '报价来自卡组织官方计算器，并非秒级市场中间价。授权日、处理日、退款以及发卡行政策可能影响最终入账；这里的银行附加费已计入一次。同币种计算仅作费用试算。商户或 ATM 的动态货币转换（DCC）可能不使用这两家卡组织的汇率。',
          )}
        </p>
        <p>{t('查询会向对应卡组织发送金额、币种、日期和所填费率，不发送卡号或账户信息。')}</p>
      </details>
    </section>
  );
}
