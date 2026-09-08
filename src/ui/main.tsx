import { t, getLanguage, setLanguage, subscribeLanguage } from '../i18n';
import { StrictMode, useEffect, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, MousePointer2, Settings as SettingsIcon } from 'lucide-react';
import { rpc, openOptions } from '../core/client';
import { ext } from '../core/storage';
import { DEFAULTS, type Settings as Prefs } from '../core/types';
import { parseMoney } from '../core/parser';
import { Brand, ErrorBox, IconButton, Toggle, LanguagePicker } from './shared';
import { Converter, type ConvertState } from './Converter';
import { Comparison } from './Comparison';
import { Watchlist } from './Watchlist';
import { Settings } from './Settings';
import { Cards } from './Cards';
import './styles.css';
function App() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage);
  const [settings, setSettings] = useState<Prefs | null>(null),
    [error, setError] = useState(''),
    [tab, setTab] = useState('convert');
  const [value, setValue] = useState<ConvertState>({ amount: '1000', from: 'USD', to: 'CNY' });
  const isSettings = location.pathname.endsWith('options.html');
  useEffect(() => {
    rpc<Prefs>({ type: 'settings' })
      .then((s) => {
        setLanguage(s.language);
        setSettings(s);
        const query = new URLSearchParams(location.search);
        const parsed = parseMoney(query.get('text') || '', s);
        setValue({
          amount: parsed ? String(parsed.amount) : query.get('amount') || '1000',
          from: parsed?.currency || query.get('from') || (s.target === 'USD' ? 'EUR' : 'USD'),
          to: query.get('to') || s.target,
        });
        if (['compare', 'cards', 'watch'].includes(query.get('tab') || ''))
          setTab(query.get('tab')!);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!settings) return;
    document.documentElement.dataset.theme = settings.theme;
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.settings?.newValue) {
        const next = changes.settings.newValue as Prefs;
        setLanguage(next.language || 'system');
        setSettings(next);
      }
    };
    ext?.storage.onChanged.addListener(listener);
    return () => ext?.storage.onChanged.removeListener(listener);
  }, [settings?.theme]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t(isSettings ? '汇见 · 设置与数据来源' : '汇见 · 随手换算').replace(
      /^汇见/,
      'RateGlide · 汇见',
    );
  }, [language, isSettings]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === 'huijian:settings' && event.newValue) {
        const next = JSON.parse(event.newValue) as Prefs;
        setLanguage(next.language || 'system');
        setSettings(next);
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  async function save(p: Partial<Prefs>) {
    const s = await rpc<Prefs>({ type: 'saveSettings', patch: p });
    setLanguage(s.language);
    setSettings(s);
    if (p.target) setValue((v) => ({ ...v, to: p.target! }));
  }
  if (!settings)
    return (
      <div className="startup">
        <Brand />
        {error ? (
          <ErrorBox message={error} onRetry={() => location.reload()} />
        ) : (
          <p>{t('正在准备你的汇率空间…')}</p>
        )}
      </div>
    );
  if (isSettings) return <Settings settings={settings} save={save} />;
  return (
    <div
      className={
        'popup ' + (tab === 'compare' ? 'compare-view' : tab === 'cards' ? 'card-tab' : '')
      }
    >
      <header className="popup-header">
        <Brand />
        <div className="header-actions">
          <LanguagePicker
            compact
            value={settings.language}
            onChange={(language) => void save({ language }).catch((e) => setError(e.message))}
          />
          <IconButton label={t('打开设置')} onClick={() => openOptions()}>
            <SettingsIcon size={20} />
          </IconButton>
        </div>
      </header>
      <nav className="tabs" aria-label={t('主要功能')}>
        {[
          ['convert', '换算'],
          ['compare', '比价'],
          ['cards', '刷卡'],
          ['watch', '关注'],
        ].map(([id, n]) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            {t(n)}
          </button>
        ))}
      </nav>
      <main>
        {error ? <ErrorBox message={error} /> : null}
        {tab === 'convert' ? (
          <>
            <Converter
              settings={settings}
              value={value}
              setValue={setValue}
              onCompare={() => setTab('compare')}
              onFavorite={() =>
                void save({
                  favorites: settings.favorites.includes(value.from)
                    ? settings.favorites.filter((c) => c !== value.from)
                    : [...settings.favorites, value.from],
                })
              }
            />
          </>
        ) : tab === 'compare' ? (
          <Comparison value={value} setValue={setValue} onBack={() => setTab('convert')} />
        ) : tab === 'cards' ? (
          <Cards value={value} setValue={setValue} settings={settings} save={save} />
        ) : (
          <Watchlist
            settings={settings}
            save={save}
            onSelect={(from) => {
              setValue((v) => ({ ...v, from, to: settings.target }));
              setTab('convert');
            }}
          />
        )}
      </main>
      {tab !== 'cards' ? (
        <footer className="popup-footer">
          <MousePointer2 size={20} />
          <div>
            <b>{t('网页划词')}</b>
            <span>
              {t(settings.enabled ? '选中外币价格，让换算随手发生' : '已暂停，仍可使用工具栏换算')}
            </span>
          </div>
          <Toggle
            checked={settings.enabled}
            onChange={(enabled) => void save({ enabled })}
            label={t('网页划词开关')}
          />
        </footer>
      ) : null}
      <a className="bottom-link" href="options.html#sources" target="_blank">
        {t('查看数据来源与支持范围')}
        <ArrowUpRight size={12} />
      </a>
    </div>
  );
}
if (
  ext &&
  location.pathname.endsWith('popup.html') &&
  new URLSearchParams(location.search).get('popup') === '1'
)
  document.documentElement.classList.add('extension-popup');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
