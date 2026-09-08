import { t } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { directory } from '../data/directory';
import type { Settings } from '../core/types';
import { Cards } from './Cards';
import { Comparison } from './Comparison';
import { RevolutPanel } from './RevolutPanel';
import { Converter, type ConvertState } from './Converter';
import { CurrencyPicker, External, IconButton } from './shared';

export function Sources({
  settings,
  save,
}: {
  settings: Settings;
  save: (s: Partial<Settings>) => Promise<void>;
}) {
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('全部'),
    [selected, setSelected] = useState('');
  const workspace = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected) workspace.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [selected]);
  const [value, setValue] = useState<ConvertState>({ amount: '100', from: 'USD', to: 'CNY' });
  const list = directory.filter(
    (p) =>
      (filter === '全部' || p.category === filter) &&
      (p.name + p.note + t(p.name) + t(p.note)).toLowerCase().includes(search.toLowerCase()),
  );
  function select(name: string) {
    setSelected(name);
    setValue(
      name === '中国银行' || name === 'Visa' || name.startsWith('Mastercard') || name === 'Revolut'
        ? { amount: '100', from: 'USD', to: 'CNY' }
        : { amount: '1000', from: 'GBP', to: 'EUR' },
    );
  }
  return (
    <>
      <section className="settings-section">
        <h2>{t('在汇见里，直接看报价')}</h2>
        <p>
          {t(
            'Visa、万事达与 Revolut 已接入官方公开计算器。银行与平台的可用报价按地区、币种和金额分别展示，无需跳转查询。',
          )}
        </p>
        <div className="source-table">
          <div className="source-table-head">
            <span>{t('来源')}</span>
            <span>{t('更新方式')}</span>
            <span>{t('数据边界')}</span>
          </div>
          {[
            [
              'Visa / Mastercard',
              '按需查询 · 缓存 5 分钟',
              '官方卡组织汇率、实际报价日期、发卡行附加费与账单金额。',
            ],
            ['Revolut', '按需查询', '官方公开换币报价、账户地区、套餐费用；不读取个人账户。'],
            ['Wise', '按需查询 · 缓存 1 分钟', '实时中间价，不含汇款费用。'],
            [
              'Wise 比价',
              '按路线请求',
              '第三方报价约每小时采集，再按最新中间价估算；可返回 HSBC、PayPal 等。',
            ],
            [
              '中国银行',
              '按需查询 · 缓存 5 分钟',
              '人民币与已公布外币的现汇买入／卖出价；不是现钞价。',
            ],
            [
              'ExchangeRate-API',
              '每日更新 · 每小时检查',
              '166 种货币的每日参考；覆盖以实际响应为准。',
            ],
            ['Frankfurter', '每日公布', '多家央行及官方机构的每日参考汇率。'],
          ].map(([n, f, d]) => (
            <div key={n}>
              <b>{t(n)}</b>
              <span>{t(f)}</span>
              <p>{t(d)}</p>
            </div>
          ))}
        </div>
        <details className="inline-info">
          <summary>{t('来源与计算方法')}</summary>
          <p>
            {t(
              '卡组织报价保留官方返回日期。Mastercard 尚未公布当日报价时，可能返回最近公布日。两家卡组织的金额均已包含所填银行费率一次。Wise 比价为采集估算，Revolut 为公开换币计算器，各机构账户内优惠可能不同。',
            )}
          </p>
          <p>
            {t('每日参考数据由')}
            <External href="https://www.exchangerate-api.com">ExchangeRate-API</External>
            {t('提供；此处为数据署名，查询在插件内完成。')}
          </p>
        </details>
      </section>
      <section className="settings-section">
        <h2>{t('选择机构，在下方查询')}</h2>
        <p>
          {t(
            '银行与汇款机构默认展示 GBP → EUR 示例路线；你可以修改币种与地区。机构未返回报价时会明确显示。',
          )}
        </p>
        <div className="directory-controls">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label={t('搜索银行和平台')}
              placeholder={t('搜索银行或平台')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="mini-tabs">
            {['全部', '汇款平台', '银行', '卡组织'].map((x) => (
              <button key={x} className={filter === x ? 'active' : ''} onClick={() => setFilter(x)}>
                {t(x)}
              </button>
            ))}
          </div>
        </div>
        <div className="directory">
          {list.map((p) => (
            <button
              key={t(p.name)}
              className={selected === p.name ? 'selected' : ''}
              onClick={() => select(p.name)}
              aria-pressed={selected === p.name}
            >
              <span className="provider-monogram" style={{ color: p.color }}>
                {t(p.short)}
              </span>
              <div>
                <b>{t(p.name)}</b>
                <p>{t(p.note)}</p>
              </div>
              <span className="directory-type">{t(p.category)}</span>
              <span className="query-label">{t('查看报价')}</span>
            </button>
          ))}
          {!list.length ? <p className="empty">{t('没有匹配的平台，试试英文名称。')}</p> : null}
        </div>
      </section>
      {selected ? (
        <section className="provider-workspace" ref={workspace}>
          <div className="section-heading">
            <h2>{t(selected)}</h2>
            <IconButton label={t('关闭机构查询')} onClick={() => setSelected('')}>
              <X size={17} />
            </IconButton>
          </div>
          {selected === 'Visa' || selected.startsWith('Mastercard') ? (
            <Cards value={value} setValue={setValue} settings={settings} save={save} />
          ) : selected === '中国银行' ? (
            <Converter
              value={value}
              setValue={setValue}
              settings={{ ...settings, source: 'boc' }}
              onCompare={() => setSelected('Wise')}
              onFavorite={() =>
                void save({
                  favorites: settings.favorites.includes(value.from)
                    ? settings.favorites.filter((c) => c !== value.from)
                    : [...settings.favorites, value.from],
                })
              }
            />
          ) : selected === 'Revolut' ? (
            <>
              <div className="compare-input">
                <input
                  aria-label={t('Revolut 换币金额')}
                  value={value.amount}
                  onChange={(e) => setValue({ ...value, amount: e.target.value })}
                />
                <CurrencyPicker
                  label={t('Revolut 原币种')}
                  value={value.from}
                  onChange={(from) => setValue({ ...value, from })}
                />
                <span>→</span>
                <CurrencyPicker
                  label={t('Revolut 目标币种')}
                  value={value.to}
                  onChange={(to) => setValue({ ...value, to })}
                />
              </div>
              <RevolutPanel value={value} />
            </>
          ) : (
            <Comparison
              value={value}
              setValue={setValue}
              onBack={() => setSelected('')}
              provider={selected.split(' ')[0]}
            />
          )}
        </section>
      ) : null}
    </>
  );
}
