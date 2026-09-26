import { t } from '../i18n';
import { useEffect, useState } from 'react';
import { ChevronRight, Plus, Star } from 'lucide-react';
import { rpc } from '../core/client';
import { currencyName, flag, formatRate } from '../data/currencies';
import { marketQuote, type MarketTable } from '../core/providers';
import type { Settings } from '../core/types';
import { CurrencyPicker, ErrorBox, Loading, timeLabel } from './shared';
const MAX_FAVORITES = 20;
const suggestions = 'USD EUR GBP JPY HKD SGD AUD CAD CHF KRW TWD THB NZD MYR CNY'.split(' ');
function suggestion(settings: Settings, fallback = 'AUD') {
  return (
    suggestions.find((c) => c !== settings.target && !settings.favorites.includes(c)) ?? fallback
  );
}
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
    [add, setAdd] = useState(() => suggestion(settings));
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
  const list = settings.favorites.filter((c) => c !== settings.target);
  const blocked = settings.favorites.includes(add)
    ? '已在关注列表中'
    : add === settings.target
      ? '这是目标货币'
      : settings.favorites.length >= MAX_FAVORITES
        ? '最多关注 20 种货币'
        : '';
  return (
    <section className="watchlist">
      <div className="section-heading">
        <h3>{t('关注的货币')}</h3>
        <span>
          {t('兑')}
          {settings.target}
        </span>
      </div>
      {!table && !error ? <Loading /> : null}
      {error ? <ErrorBox message={error} onRetry={() => setRevision((x) => x + 1)} /> : null}
      {!list.length ? (
        <p className="empty">{t('把常用币种放在这里，随时查看参考价。')}</p>
      ) : (
        list.map((code) => (
          <div className="watch-row" key={code}>
            <button
              className="watch-main"
              title={t('在换算中打开 {0}', [code])}
              onClick={() => onSelect(code)}
            >
              <span className="flag">{flag(code)}</span>
              <span>
                {code} / {settings.target}
                <small>{currencyName(code)}</small>
              </span>
              <b>
                {table?.rates[code] && table?.rates[settings.target]
                  ? formatRate(marketQuote(table, code, settings.target).rate)
                  : '—'}
              </b>
              <ChevronRight size={15} aria-hidden="true" />
            </button>
            <button
              className="icon-button"
              aria-label={t('取消关注 ') + code}
              title={t('取消关注 ') + code}
              onClick={() => save({ favorites: settings.favorites.filter((c) => c !== code) })}
            >
              <Star size={15} fill="currentColor" />
            </button>
          </div>
        ))
      )}
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
