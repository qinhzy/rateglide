import { t } from '../i18n';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Plus, Star } from 'lucide-react';
import { rpc } from '../core/client';
import { currencyName, flag, formatRate } from '../data/currencies';
import { marketQuote, type MarketTable } from '../core/providers';
import type { Settings } from '../core/types';
import { CurrencyPicker, ErrorBox, Loading, timeLabel } from './shared';
export function Watchlist({
  settings,
  onSelect,
  save,
  compact = false,
}: {
  settings: Settings;
  onSelect: (c: string) => void;
  save: (s: Partial<Settings>) => void;
  compact?: boolean;
}) {
  const [table, setTable] = useState<MarketTable | null>(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [add, setAdd] = useState('AUD');
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
  const list = (compact ? settings.favorites.slice(0, 3) : settings.favorites).filter(
    (c) => c !== settings.target,
  );
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
            <button className="watch-main" onClick={() => onSelect(code)}>
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
              <ArrowUpRight size={15} />
            </button>
            {!compact ? (
              <button
                className="icon-button"
                aria-label={t('取消关注 ') + code}
                onClick={() => save({ favorites: settings.favorites.filter((c) => c !== code) })}
              >
                <Star size={15} fill="currentColor" />
              </button>
            ) : null}
          </div>
        ))
      )}
      {!compact ? (
        <div className="add-favorite">
          <CurrencyPicker value={add} onChange={setAdd} label={t('添加关注币种')} />
          <button
            className="secondary"
            disabled={settings.favorites.includes(add) || settings.favorites.length >= 20}
            onClick={() => save({ favorites: [...settings.favorites, add] })}
          >
            <Plus size={16} />
            {t('添加关注')}
          </button>
        </div>
      ) : null}
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
