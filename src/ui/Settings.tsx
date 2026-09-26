import { t } from '../i18n';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Database,
  Download,
  History,
  MousePointer2,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { rpc } from '../core/client';
import { ext } from '../core/storage';
import { SOURCE_LABELS } from '../core/providers';
import { formatAmount } from '../data/currencies';
import type { HistoryEntry, Settings as Prefs, Source } from '../core/types';
import {
  Brand,
  CurrencyPicker,
  ErrorBox,
  IconButton,
  Toggle,
  timeLabel,
  LanguagePicker,
} from './shared';
import { Sources } from './Sources';
const TABS = ['preferences', 'sources', 'guide', 'history'] as const;
type SettingsTab = (typeof TABS)[number];
function tabFromHash(): SettingsTab {
  const hash = location.hash.replace('#', '');
  return TABS.find((tab) => tab === hash) ?? 'preferences';
}
/** The browser's current shortcut for converting a selection; null when it cannot be read. */
function useShortcut() {
  const [shortcut, setShortcut] = useState<string | null>(null);
  useEffect(() => {
    if (!ext?.commands?.getAll) return;
    Promise.resolve()
      .then(() => ext!.commands.getAll())
      .then((commands) =>
        setShortcut(commands.find((c) => c.name === 'convert-selection')?.shortcut ?? ''),
      )
      .catch(() => {});
  }, []);
  return shortcut;
}
// Chromium browsers list extension shortcuts on an internal page that extensions may open.
const shortcutPage = /Edg\//.test(navigator.userAgent)
  ? 'edge://extensions/shortcuts'
  : /Chrome\//.test(navigator.userAgent)
    ? 'chrome://extensions/shortcuts'
    : '';
function ShortcutControl({ shortcut }: { shortcut: string }) {
  return (
    <div className="shortcut-control">
      {shortcut ? <kbd>{shortcut}</kbd> : <span>{t('未设置')}</span>}
      {ext && shortcutPage ? (
        <button
          type="button"
          className="text-button"
          onClick={() => void ext!.tabs.create({ url: shortcutPage })}
        >
          {t('修改')}
        </button>
      ) : null}
    </div>
  );
}
function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div>
        <b>{title}</b>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function Settings({
  settings,
  save,
}: {
  settings: Prefs;
  save: (s: Partial<Prefs>) => Promise<void>;
}) {
  const [tab, setTab] = useState(tabFromHash),
    [saved, setSaved] = useState(false),
    [error, setError] = useState('');
  const shortcut = useShortcut();
  useEffect(() => {
    const sync = () => setTab(tabFromHash());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  async function update(p: Partial<Prefs>) {
    try {
      await save(p);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const nav = [
    ['preferences', '偏好设置', Settings2],
    ['sources', '数据来源', Database],
    ['guide', '使用指南', BookOpen],
    ['history', '本地历史', History],
  ] as const satisfies readonly (readonly [SettingsTab, string, unknown])[];
  return (
    <div className="settings-layout">
      <aside>
        <Brand />
        <nav aria-label={t('设置导航')}>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={tab === id ? 'active' : ''}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => {
                setTab(id);
                history.replaceState(null, '', '#' + id);
              }}
            >
              <Icon size={18} />
              {t(label)}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <ShieldCheck size={18} />
          <p>
            {t('让世界的价格，')}
            <br />
            {t('更贴近你。')}
          </p>
          <span>RateGlide · v{__APP_VERSION__}</span>
        </div>
      </aside>
      <main className="settings-main">
        <header>
          <h1>{t('让每一次兑换，心中有数。')}</h1>
          <p>{t('在任意网页，选中外币价格，即刻换算、比价、掌握汇率来源。')}</p>
          <span className="save-status" role="status">
            {saved ? (
              <>
                <Check size={15} />
                {t('已保存')}
              </>
            ) : null}
          </span>
        </header>
        {error ? <ErrorBox message={error} /> : null}
        {tab === 'preferences' ? (
          <>
            <section className="settings-section">
              <h2>{t('按你的习惯，随手换算')}</h2>
              <div className="settings-group">
                <SettingRow
                  title={t('界面语言')}
                  description={t('跟随浏览器或手动选择；网页划词提示也会同步')}
                >
                  <LanguagePicker
                    value={settings.language}
                    onChange={(language) => void update({ language })}
                  />
                </SettingRow>
                <SettingRow title={t('目标货币')} description={t('网页划词结果默认显示的货币')}>
                  <CurrencyPicker
                    value={settings.target}
                    label={t('默认目标货币')}
                    onChange={(target) => update({ target })}
                  />
                </SettingRow>
                <SettingRow
                  title={t('遇到 $ 时')}
                  description={t('美元、港币、加元等共用此符号；浮层会提示并允许修改')}
                >
                  <CurrencyPicker
                    value={settings.defaultDollar}
                    label={t('默认美元符号币种')}
                    onChange={(defaultDollar) => update({ defaultDollar })}
                  />
                </SettingRow>
                <SettingRow
                  title={t('遇到 ¥ 时')}
                  description={t('日元与人民币共用此符号；浮层会提示并允许修改')}
                >
                  <CurrencyPicker
                    value={settings.defaultYen}
                    label={t('默认日元符号币种')}
                    onChange={(defaultYen) => update({ defaultYen })}
                  />
                </SettingRow>
                <SettingRow
                  title={t('首选汇率来源')}
                  description={t('智能选择优先 Wise，失败时明确提示使用每日参考价')}
                >
                  <select
                    value={settings.source}
                    aria-label={t('默认汇率来源')}
                    onChange={(e) => update({ source: e.target.value as Source })}
                  >
                    {Object.entries(SOURCE_LABELS).map(([v, n]) => (
                      <option value={v} key={v}>
                        {t(n)}
                      </option>
                    ))}
                  </select>
                </SettingRow>
              </div>
            </section>
            <section className="settings-section">
              <h2>{t('恰到好处的出现')}</h2>
              <div className="settings-group">
                <SettingRow title={t('网页划词')} description={t('选中一笔外币金额时显示汇见')}>
                  <Toggle
                    checked={settings.enabled}
                    label={t('启用网页划词')}
                    onChange={(enabled) => update({ enabled })}
                  />
                </SettingRow>
                <SettingRow
                  title={t('划词换算模式')}
                  description={t('默认先显示小提示，点击后才查询汇率')}
                >
                  <select
                    value={settings.mode}
                    aria-label={t('划词换算模式')}
                    onChange={(e) => update({ mode: e.target.value as Prefs['mode'] })}
                  >
                    <option value="prompt">{t('选中后提示')}</option>
                    <option value="instant">{t('选中后直接换算')}</option>
                    <option value="alt">{t('按住 Alt / Option 再选中')}</option>
                  </select>
                </SettingRow>
                {shortcut !== null ? (
                  <SettingRow
                    title={t('快捷键')}
                    description={t('选中文字后按下即可换算，也适用于已是目标货币的价格')}
                  >
                    <ShortcutControl shortcut={shortcut} />
                  </SettingRow>
                ) : null}
                <SettingRow
                  title={t('识别纯数字')}
                  description={t('无货币符号时也提示；可能把普通数字识别为金额')}
                >
                  <Toggle
                    checked={settings.numbersOnly}
                    label={t('识别纯数字')}
                    onChange={(numbersOnly) => update({ numbersOnly })}
                  />
                </SettingRow>
                {settings.numbersOnly ? (
                  <SettingRow title={t('纯数字默认货币')} description={t('用于没有币种信息的金额')}>
                    <CurrencyPicker
                      label={t('纯数字默认货币')}
                      value={settings.defaultCurrency}
                      onChange={(defaultCurrency) => update({ defaultCurrency })}
                    />
                  </SettingRow>
                ) : null}
                <SettingRow title={t('外观')} description={t('划词浮层和插件界面同步使用')}>
                  <select
                    value={settings.theme}
                    aria-label={t('外观')}
                    onChange={(e) => update({ theme: e.target.value as Prefs['theme'] })}
                  >
                    <option value="system">{t('跟随系统')}</option>
                    <option value="light">{t('浅色')}</option>
                    <option value="dark">{t('深色')}</option>
                  </select>
                </SettingRow>
              </div>
            </section>
            <BlockedSites settings={settings} save={update} />
            <section className="settings-section">
              <h2>{t('隐私，留在本机')}</h2>
              <div className="settings-group">
                <SettingRow
                  title={t('记录已复制的换算')}
                  description={t(
                    '默认关闭。开启后仅保存最近 50 条金额、币种和结果，不记录网址或原文',
                  )}
                >
                  <Toggle
                    checked={settings.rememberHistory}
                    label={t('记录换算历史')}
                    onChange={(rememberHistory) => update({ rememberHistory })}
                  />
                </SettingRow>
              </div>
              <p className="section-note">
                {t(
                  '选中文字在本机识别。普通换算只查询货币对，点击比价才提交金额；无广告、无分析埋点，不读取账号、密码或支付信息。',
                )}
              </p>
            </section>
          </>
        ) : tab === 'sources' ? (
          <Sources settings={settings} save={update} />
        ) : tab === 'guide' ? (
          <Guide target={settings.target} shortcut={shortcut} />
        ) : (
          <LocalHistory settings={settings} save={update} />
        )}
        <footer className="settings-footer">
          {t('汇见仅辅助查询与计算。实时中间价、银行牌价、参考价和最终到账价各自标明。')}
        </footer>
      </main>
    </div>
  );
}
function BlockedSites({ settings, save }: { settings: Prefs; save: (s: Partial<Prefs>) => void }) {
  const [domain, setDomain] = useState(''),
    [error, setError] = useState('');
  function add() {
    let d = domain.trim().toLowerCase();
    try {
      d = new URL(d.includes('://') ? d : 'https://' + d).host;
    } catch {
      setError('请输入域名，例如 example.com');
      return;
    }
    if (!/^[a-z0-9.-]+(?::\d+)?$/.test(d) || !d.includes('.')) {
      setError('请输入有效域名');
      return;
    }
    save({ blockedSites: [...settings.blockedSites, d] });
    setDomain('');
    setError('');
  }
  return (
    <section className="settings-section">
      <h2>{t('这些网站，保持安静')}</h2>
      <p>{t('被屏蔽的域名及其子域名不显示划词浮层。右键菜单仍可手动换算。')}</p>
      <div className="domain-form">
        <input
          aria-label={t('屏蔽网站域名')}
          placeholder={t('例如 example.com')}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
        />
        <button className="secondary" onClick={add}>
          {t('添加网站')}
        </button>
      </div>
      {error ? <ErrorBox message={error} /> : null}
      <div className="blocked-list">
        {settings.blockedSites.map((d) => (
          <span key={d}>
            {d}
            <IconButton
              label={t('移除屏蔽 ') + d}
              onClick={() => save({ blockedSites: settings.blockedSites.filter((x) => x !== d) })}
            >
              <X size={14} />
            </IconButton>
          </span>
        ))}
      </div>
    </section>
  );
}
function Guide({ target, shortcut }: { target: string; shortcut: string | null }) {
  // Prices already in the home currency stay quiet, so the example uses another currency.
  const example = target === 'USD' ? '€129.00' : '$129.00';
  return (
    <>
      <section className="settings-section guide-intro">
        <MousePointer2 size={30} />
        <h2>{t('一次选中，少一次心算')}</h2>
        <p>
          {t('在普通网页上，用鼠标选中一笔完整价格，例如')}
          <strong>{example}</strong>
          {t('，点击「换算为 {0}」即可。按 Escape 或点击空白处关闭浮层。', [target])}
        </p>
        <div className="practice-prices">
          <span>US$ 129.00</span>
          <span>€ 1.234,56</span>
          <span>HK$ 2,680</span>
          <span>{t('2.5万日元')}</span>
        </div>
        <p className="notice">
          {t('上方为格式示例。练习页专门启用了划词功能，安装后可直接体验，无需启动本地服务。')}
        </p>
        <a className="secondary" href="/practice.html" target="_blank" rel="noreferrer">
          {t('打开划词练习页')}
          <ArrowUpRight size={16} />
        </a>
      </section>
      <section className="settings-section">
        <h2>{t('你可能会用到')}</h2>
        <div className="guide-list">
          {[
            [
              '金额怎么识别',
              '支持 ISO 币种代码、常见符号、中文币名、欧美小数格式、印度分组、万／亿与 k／m。选中多个价格或范围不会自动相加。',
            ],
            [
              '$ 和 ¥ 是哪种货币',
              '同一符号可能代表不同货币。默认 $ 为美元、¥ 为日元，提示中会标明；可在浮层或设置里更改。',
            ],
            [
              '不想每次点击提示',
              '在偏好设置切换到「选中后直接换算」，或仅在按住 Alt / Option 选中时触发。',
            ],
            [
              '快捷键与右键',
              '右键选中文字 → 用 RateGlide 换算；默认快捷键 Alt / Option + Shift + C（浏览器有冲突时可在扩展快捷键管理中修改）。已是目标货币的价格不会自动提示，可用这两种方式换算。',
            ],
            [
              '报价为什么不同',
              '中间价没有扣除费用。银行现汇买入／卖出是两个方向；平台到账价还受手续费、金额、国家、支付方式影响。',
            ],
            [
              '离线与过期',
              '短暂断网时可显示最多 7 天内缓存，并标记过期；无缓存则提供重试。旧数据不会标成实时价。',
            ],
            [
              '哪些页面无法划词',
              'Chrome / Edge 设置页、扩展商店、其他扩展页面、浏览器内置 PDF 阅读器等受浏览器限制。可使用工具栏手动换算。输入框、密码框和可编辑区域默认不触发。',
            ],
            [
              'Chrome 与 Edge',
              '打开扩展管理页，启用开发者模式，加载 release/chromium 文件夹。安装后刷新已打开的普通网页。',
            ],
            [
              'Safari',
              '新版 Safari 可在「设置 → 开发者 → 添加临时扩展」选择 safari-web-extension 文件夹；需要系统授权，退出 Safari 或 24 小时后须重新添加。长期安装需打包为经过 Apple 签名的 Safari 扩展。',
            ],
          ].map(([title, description]) => (
            <div key={title}>
              <h3>{t(title)}</h3>
              <p>{t(description)}</p>
              {title === '快捷键与右键' && shortcut !== null ? (
                <div className="guide-shortcut">
                  <span>{t('当前快捷键')}</span>
                  <ShortcutControl shortcut={shortcut} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
function LocalHistory({
  settings,
  save,
}: {
  settings: Prefs;
  save: (s: Partial<Prefs>) => Promise<void>;
}) {
  const [items, setItems] = useState<HistoryEntry[]>([]),
    [error, setError] = useState(''),
    [confirming, setConfirming] = useState(false);
  useEffect(() => {
    rpc<HistoryEntry[]>({ type: 'history' })
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    // The confirmation expires, so a stray second click later cannot erase history.
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);
  async function clear() {
    try {
      await rpc({ type: 'clearHistory' });
      setItems([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConfirming(false);
    }
  }
  function exportCsv() {
    const content =
      t('\ufeff时间,金额,原币,目标币,换算结果,来源\n') +
      items
        .map((x) =>
          [new Date(x.time).toISOString(), x.amount, x.from, x.to, x.result, t(x.source)]
            .map((v) => '"' + String(v).replaceAll('"', '""') + '"')
            .join(','),
        )
        .join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'RateGlide-history.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="settings-section">
      <div className="section-heading">
        <h2>{t('只留在这台浏览器里')}</h2>
        <div className="history-actions">
          <button className="text-button" disabled={!items.length} onClick={exportCsv}>
            <Download size={15} />
            {t('导出')}
          </button>
          <button
            className={'text-button ' + (confirming ? 'danger' : '')}
            disabled={!items.length}
            onClick={() => (confirming ? void clear() : setConfirming(true))}
          >
            <Trash2 size={15} />
            {t(confirming ? '确认清空全部记录？' : '清空')}
          </button>
        </div>
      </div>
      <p>
        {t('开启记录后，每次主动复制换算结果会保存一条。最多 50 条，不保存网页地址或选中原文。')}
      </p>
      {error ? <ErrorBox message={error} /> : null}
      {!settings.rememberHistory ? (
        <div className="settings-group history-switch">
          <SettingRow
            title={t('记录已复制的换算')}
            description={t('当前未开启，复制换算结果不会保存')}
          >
            <Toggle
              checked={false}
              label={t('记录换算历史')}
              onChange={(rememberHistory) => void save({ rememberHistory })}
            />
          </SettingRow>
        </div>
      ) : null}
      {items.length ? (
        <div className="history-list">
          {items.map((i) => (
            <div key={i.id}>
              <span>
                {formatAmount(i.amount, i.from)} {i.from}
                <small>
                  {t(i.source)} · {timeLabel(i.time)}
                </small>
              </span>
              <b>
                {formatAmount(i.result, i.to)} {i.to}
              </b>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          <History size={28} />
          <h3>{t('还没有保存的换算')}</h3>
          <p>
            {t(
              settings.rememberHistory
                ? '复制一次换算结果，它会出现在这里。'
                : '在偏好设置中开启记录，然后复制一次换算结果。',
            )}
          </p>
        </div>
      )}
    </section>
  );
}
