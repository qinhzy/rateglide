import { t, getLanguage, setLanguage, subscribeLanguage } from '../i18n';
import { StrictMode, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, MousePointer2, Settings as SettingsIcon } from 'lucide-react';
import { rpc, openOptions } from '../core/client';
import { ext, read, siteBlocked, write } from '../core/storage';
import { type Settings as Prefs } from '../core/types';
import { parseMoney } from '../core/parser';
import { currencyCodes } from '../data/currencies';
import {
  Brand,
  ErrorBox,
  IconButton,
  Toggle,
  LanguagePicker,
  SettingsContext,
  type ConvertState,
} from './shared';
import { Converter } from './Converter';
import { Comparison } from './Comparison';
import { Watchlist } from './Watchlist';
import { Settings } from './Settings';
import { Cards } from './Cards';
import './styles.css';
const TABS = [
  ['convert', '换算'],
  ['compare', '比价'],
  ['cards', '刷卡'],
  ['watch', '关注'],
] as const;
type Tab = (typeof TABS)[number][0];
type LastConversion = ConvertState & { target: string };
// Hosts the selection helper can be paused on; matches the stored blocked-site format.
const pausableHost = /^[a-z0-9.-]+(?::\d+)?$/;
/** Where the popup opens: an explicit request in the URL, otherwise the last conversion. */
async function initialConversion(s: Prefs): Promise<ConvertState> {
  const query = new URLSearchParams(location.search);
  const parsed = parseMoney(query.get('text') || '', s);
  const fallbackFrom = s.target === 'USD' ? 'EUR' : 'USD';
  if (parsed || query.has('from') || query.has('to') || query.has('amount'))
    return {
      amount: parsed ? String(parsed.amount) : query.get('amount') || '1000',
      from: parsed?.currency || query.get('from') || fallbackFrom,
      to: query.get('to') || s.target,
    };
  const last = await read<LastConversion | null>('lastConversion', null).catch(() => null);
  if (!last || !currencyCodes.has(last.from) || !currencyCodes.has(last.to))
    return { amount: '1000', from: fallbackFrom, to: s.target };
  // A home currency changed in Preferences takes over the result side.
  const to = last.target === s.target ? last.to : s.target;
  const from = last.from === to ? (last.to === to ? fallbackFrom : last.to) : last.from;
  return { amount: typeof last.amount === 'string' ? last.amount : '1000', from, to };
}
function App() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage);
  const [settings, setSettings] = useState<Prefs | null>(null),
    [error, setError] = useState(''),
    [tab, setTab] = useState<Tab>('convert'),
    [site, setSite] = useState('');
  const [value, setValue] = useState<ConvertState | null>(null);
  const focusOnOpen = useRef(true);
  const isSettings = location.pathname.endsWith('options.html');
  useEffect(() => {
    rpc<Prefs>({ type: 'settings' })
      .then(async (s) => {
        setLanguage(s.language);
        if (!isSettings) {
          setValue(await initialConversion(s));
          const requested = new URLSearchParams(location.search).get('tab');
          const match = TABS.find(([id]) => id === requested);
          if (match) setTab(match[0]);
        }
        setSettings(s);
      })
      .catch((e) => setError(e.message));
  }, []);
  const homeCurrency = useRef('');
  useEffect(() => {
    // Follow home-currency changes from any page, keeping the two sides different.
    if (!settings) return;
    const previous = homeCurrency.current;
    homeCurrency.current = settings.target;
    if (previous && previous !== settings.target)
      setValue(
        (v) =>
          v && {
            ...v,
            to: settings.target,
            from: v.from === settings.target ? v.to : v.from,
          },
      );
  }, [settings?.target]);
  useEffect(() => {
    if (value && settings && !isSettings)
      void write('lastConversion', { ...value, target: settings.target }).catch(() => {});
  }, [value, settings?.target]);
  useEffect(() => {
    if (settings && tab !== 'convert') focusOnOpen.current = false;
  }, [tab, settings]);
  useEffect(() => {
    // Ask the page in the active tab for its host so selection can be paused there.
    if (isSettings || !ext?.tabs?.query) return;
    let alive = true;
    ext.tabs
      .query({ active: true, currentWindow: true })
      .then(([active]) =>
        active?.id === undefined
          ? null
          : ext!.tabs.sendMessage(active.id, { type: 'siteInfo' }, { frameId: 0 }),
      )
      .then((info) => {
        const host = typeof info?.host === 'string' ? info.host.toLowerCase() : '';
        if (alive && /^https?:$/.test(info?.protocol) && pausableHost.test(host)) setSite(host);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
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
  }
  if (!settings || (!isSettings && !value))
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
  if (isSettings)
    return (
      <SettingsContext.Provider value={settings}>
        <Settings settings={settings} save={save} />
      </SettingsContext.Provider>
    );
  const conversion = value!;
  const setConversion = (v: ConvertState) => setValue(v);
  const paused = !!site && siteBlocked(site, settings.blockedSites);
  const displayHost = site.replace(/^www\./, '');
  function toggleSite() {
    void save({
      blockedSites: paused
        ? settings!.blockedSites.filter((b) => !(site === b || site.endsWith('.' + b)))
        : [...settings!.blockedSites, displayHost],
    }).catch((e) => setError(e.message));
  }
  return (
    <SettingsContext.Provider value={settings}>
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
        <div
          className="tabs"
          role="tablist"
          aria-label={t('主要功能')}
          onKeyDown={(e) => {
            const index = TABS.findIndex(([id]) => id === tab);
            const next =
              e.key === 'ArrowRight'
                ? (index + 1) % TABS.length
                : e.key === 'ArrowLeft'
                  ? (index + TABS.length - 1) % TABS.length
                  : e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? TABS.length - 1
                      : -1;
            if (next < 0) return;
            e.preventDefault();
            setTab(TABS[next][0]);
            document.getElementById('tab-' + TABS[next][0])?.focus();
          }}
        >
          {TABS.map(([id, n]) => (
            <button
              key={id}
              id={'tab-' + id}
              type="button"
              role="tab"
              className={tab === id ? 'active' : ''}
              aria-selected={tab === id}
              aria-controls="popup-panel"
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
            >
              {t(n)}
            </button>
          ))}
        </div>
        <main id="popup-panel" role="tabpanel" aria-labelledby={'tab-' + tab}>
          {error ? <ErrorBox message={error} /> : null}
          {tab === 'convert' ? (
            <Converter
              settings={settings}
              value={conversion}
              setValue={setConversion}
              autoFocus={focusOnOpen.current}
              onCompare={() => setTab('compare')}
              onFavorite={() =>
                void save({
                  favorites: settings.favorites.includes(conversion.from)
                    ? settings.favorites.filter((c) => c !== conversion.from)
                    : [...settings.favorites, conversion.from],
                })
              }
            />
          ) : tab === 'compare' ? (
            <Comparison
              value={conversion}
              setValue={setConversion}
              onBack={() => setTab('convert')}
            />
          ) : tab === 'cards' ? (
            <Cards value={conversion} setValue={setConversion} settings={settings} save={save} />
          ) : (
            <Watchlist
              settings={settings}
              save={save}
              onSelect={(from) => {
                setValue({ ...conversion, from, to: settings.target });
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
                {t(
                  settings.enabled ? '选中外币价格，让换算随手发生' : '已暂停，仍可使用工具栏换算',
                )}
              </span>
              {site && settings.enabled ? (
                <button type="button" className="site-toggle" onClick={toggleSite}>
                  {paused
                    ? t('已在 {0} 停用 · 恢复', [displayHost])
                    : t('在 {0} 停用', [displayHost])}
                </button>
              ) : null}
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
    </SettingsContext.Provider>
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
