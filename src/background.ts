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
  handleMessage(message)
    .then((data) => reply({ ok: true, data }))
    .catch((error) =>
      reply({ ok: false, error: error instanceof Error ? error.message : '暂时无法获取数据' }),
    );
  return true;
});
let menuUpdate = Promise.resolve();
function menus() {
  menuUpdate = menuUpdate
    .catch(() => {})
    .then(async () => {
      const settings = await getSettings();
      const language = resolveLanguage(settings.language);
      await api.action?.setTitle({
        title:
          language === 'en' ? 'RateGlide · Currency at your cursor' : 'RateGlide · 汇见 · 随手换算',
      });
      if (!api.contextMenus) return;
      await api.contextMenus.removeAll();
      api.contextMenus.create({
        id: 'huijian-convert',
        title: translate('用 RateGlide 换算「%s」', language),
        contexts: ['selection'],
      });
    });
  return menuUpdate;
}
api.storage.onChanged.addListener((changes) => {
  if (changes.settings) void menus();
});
api.runtime.onStartup.addListener(() => void menus());
api.runtime.onInstalled.addListener(() => {
  void menus();
  void getSettings();
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
