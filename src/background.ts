import { translate, resolveLanguage } from './i18n';
import { ext, getSettings } from './core/storage';
import { handleMessage } from './core/service';
const api = ext!;
api.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== api.runtime.id) {
    reply({ ok: false, error: '未授权请求' });
    return false;
  }
  if (message?.type === 'openOptions') {
    void api.runtime.openOptionsPage();
    reply({ ok: true });
    return false;
  }
  if (message?.type === 'openCompare') {
    const q = new URLSearchParams({
      tab: 'compare',
      from: String(message.from),
      to: String(message.to),
      amount: String(message.amount),
    });
    void api.tabs.create({ url: api.runtime.getURL('popup.html') + '?' + q });
    reply({ ok: true });
    return false;
  }
  if (message?.type === 'siteState') {
    if (sender.tab?.id !== undefined) siteBadge(sender.tab.id, message.paused === true);
    reply({ ok: true });
    return false;
  }
  handleMessage(message)
    .then((data) => reply({ ok: true, data }))
    .catch((error) =>
      reply({ ok: false, error: error instanceof Error ? error.message : '暂时无法获取数据' }),
    );
  return true;
});
// A tab on a paused site shows OFF. Null clears the tab's own text so the global badge,
// which shows whether selection is paused everywhere, applies again.
function siteBadge(tabId: number, paused: boolean) {
  api.action
    ?.setBadgeText({ tabId, text: paused ? 'OFF' : (null as unknown as string) })
    .catch(() => {});
}
let actionUpdate = Promise.resolve();
// Keep the toolbar title, badge and context menu in step with preferences.
function syncAction() {
  actionUpdate = actionUpdate
    .catch(() => {})
    .then(async () => {
      const settings = await getSettings();
      const language = resolveLanguage(settings.language);
      const title =
        language === 'en' ? 'RateGlide · Currency at your cursor' : 'RateGlide · 汇见 · 随手换算';
      await api.action?.setTitle({
        title: settings.enabled ? title : `${title} · ${translate('网页划词已暂停', language)}`,
      });
      await api.action?.setBadgeBackgroundColor({ color: '#5f6b65' });
      await api.action?.setBadgeText({ text: settings.enabled ? '' : 'OFF' });
      if (!api.contextMenus) return;
      await api.contextMenus.removeAll();
      api.contextMenus.create({
        id: 'huijian-convert',
        title: translate('用 RateGlide 换算「%s」', language),
        contexts: ['selection'],
      });
    });
  return actionUpdate;
}
api.storage.onChanged.addListener((changes) => {
  if (changes.settings) void syncAction();
});
api.runtime.onStartup.addListener(() => void syncAction());
api.runtime.onInstalled.addListener((details) => {
  void syncAction();
  void getSettings();
  // Selection is easiest to learn by trying it once, so a new install opens the practice page.
  if (details.reason === 'install')
    void api.tabs.create({ url: api.runtime.getURL('practice.html?welcome=1') });
});
api.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'huijian-convert' && tab?.id) {
    api.tabs
      .sendMessage(
        tab.id,
        { type: 'convertSelection', text: info.selectionText },
        { frameId: info.frameId ?? 0 },
      )
      .catch(() =>
        api.tabs.create({
          url:
            api.runtime.getURL('popup.html') +
            '?text=' +
            encodeURIComponent(info.selectionText || ''),
        }),
      );
  }
});
api.commands?.onCommand.addListener(async (command) => {
  if (command === 'convert-selection') {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) api.tabs.sendMessage(tab.id, { type: 'convertSelection' }).catch(() => {});
  }
});
