import { t, getLocale } from '../i18n';
import { useEffect, useState } from 'react';
import { ChevronRight, Plus, Star } from 'lucide-react';
import { rpc } from '../core/client';
import { currencyName, flag, formatRate } from '../data/currencies';
import type { MarketTable } from '../core/providers';
import type { Settings } from '../core/types';
import { CurrencyPicker, ErrorBox, Loading, timeLabel } from './shared';
const MAX_FAVORITES = 20;
const suggestions = 'USD EUR GBP JPY HKD SGD AUD CAD CHF KRW TWD THB NZD MYR CNY'.split(' ');
function suggestion(settings: Settings, fallback = 'AUD') {
  return (
    suggestions.find((c) => c !== settings.target && !settings.favorites.includes(c)) ?? fallback
  );
}
/** How many units to quote, so 0.0477 CNY per yen reads as 4.77 CNY per 100 yen. */
export function quoteUnit(rate: number) {
  return rate >= 0.1 ? 1 : 10 ** Math.min(6, Math.ceil(Math.log10(1 / rate)));
}
const rate = (rates: Record<string, number>, code: string, target: string) =>
  rates[code] && rates[target] ? rates[target] / rates[code] : null;
export function Watchlist({
  settings,
  onSelect,
  save,
}: {
  settings: Settings;
  onSelect: (c: string) => void;
  save: (s: Partial<Settings>) => void;
}) {
  const [table, setTable] = useState<MarketTable | null>(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [add, setAdd] = useState(() => suggestion(settings)),
    [removed, setRemoved] = useState<{ code: string; favorites: string[] } | null>(null);
  useEffect(() => {
    let ok = true;
    rpc<MarketTable>({ type: 'market', force: revision > 0 })
      .then((t) => {
        if (ok) {
          setTable(t);
          setError('');
        }
      })
      .catch((e) => {
        if (ok) setError(e.message);
      });
    return () => {
      ok = false;
    };
  }, [revision]);
  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), 6000);
    return () => clearTimeout(timer);
  }, [removed]);
  const list = settings.favorites.filter((c) => c !== settings.target);
  const blocked = settings.favorites.includes(add)
    ? '已在关注列表中'
    : add === settings.target
      ? '这是目标货币'
      : settings.favorites.length >= MAX_FAVORITES
        ? '最多关注 20 种货币'
        : '';
  // Daily changes compare consecutive publications only, so “since yesterday” stays true.
  const gap = table?.previous ? table.asOf - table.previous.asOf : 0;
  const previous = gap >= 18 * 3600000 && gap <= 50 * 3600000 ? table!.previous! : null;
  const percent = new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <section className="watchlist">
      <div className="section-heading">
        <h3>{t('关注的货币')}</h3>
        <span>{t('每日参考 · 兑 {0}', [settings.target])}</span>
      </div>
      <div className="add-favorite">
        <CurrencyPicker value={add} onChange={setAdd} label={t('添加关注币种')} />
        <button
          className="secondary"
          disabled={!!blocked}
          onClick={() => {
            save({ favorites: [...settings.favorites, add] });
            setAdd(suggestion({ ...settings, favorites: [...settings.favorites, add] }, add));
          }}
        >
          <Plus size={16} />
          {t('添加关注')}
        </button>
      </div>
      {blocked ? <p className="notice add-note">{t(blocked)}</p> : null}
      {removed ? (
        <div className="undo-bar" role="status">
          <span>{t('已取消关注 {0}', [removed.code])}</span>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              save({ favorites: removed.favorites });
              setRemoved(null);
            }}
          >
            {t('撤销')}
          </button>
        </div>
      ) : null}
      {!table && !error ? <Loading /> : null}
      {error ? <ErrorBox message={error} onRetry={() => setRevision((x) => x + 1)} /> : null}
      {!list.length ? (
        <p className="empty">{t('把常用币种放在这里，随时查看参考价。')}</p>
      ) : (
        list.map((code) => {
          const now = table ? rate(table.rates, code, settings.target) : null;
          const before = previous ? rate(previous.rates, code, settings.target) : null;
          const unit = now ? quoteUnit(now) : 1;
          const change = now && before ? (now / before - 1) * 100 : null;
          return (
            <div className="watch-row" key={code}>
              <button
                className="watch-main"
                title={t('在换算中打开 {0}', [code])}
                onClick={() => onSelect(code)}
              >
                <span className="flag">{flag(code)}</span>
                <span>
                  {unit > 1 ? `${unit} ` : ''}
                  {code} / {settings.target}
                  <small>{currencyName(code)}</small>
                </span>
                <span className="watch-rate">
                  <b>{now ? formatRate(now * unit) : '—'}</b>
                  {change !== null ? (
                    <small
                      className="change"
                      title={t('较 {0} 每日参考', [timeLabel(previous!.asOf, true)])}
                    >
                      {Math.abs(change) < 0.005 ? '' : change > 0 ? '▲ ' : '▼ '}
                      {percent.format(Math.abs(change))}%
                    </small>
                  ) : null}
                </span>
                <ChevronRight size={15} aria-hidden="true" />
              </button>
              <button
                className="icon-button"
                aria-label={t('取消关注 ') + code}
                title={t('取消关注 ') + code}
                onClick={() => {
                  setRemoved({ code, favorites: settings.favorites });
                  save({ favorites: settings.favorites.filter((c) => c !== code) });
                }}
              >
                <Star size={15} fill="currentColor" />
              </button>
            </div>
          );
        })
      )}
      {table ? (
        <p className="watch-attribution">
          <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">
            ExchangeRate-API ·{' '}
            {t(
              table.offline
                ? '连接失败 · 缓存'
                : Date.now() - table.asOf > 3 * 86400000
                  ? '过期缓存'
                  : '每日参考',
            )}
          </a>
          <time>{timeLabel(table.asOf)}</time>
        </p>
      ) : null}
    </section>
  );
}
