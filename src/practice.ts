import { getLanguage, registerMessages, setLanguage, t, type LanguagePreference } from './i18n';
import { uiEnglish } from './i18n/messages';
import { rpc } from './core/client';
import { parseMoney } from './core/parser';
import { ext } from './core/storage';
import type { Settings } from './core/types';
registerMessages(uiEnglish);

// A new installation opens this page with a short welcome above the examples.
if (new URLSearchParams(location.search).has('welcome')) {
  const welcome = document.createElement('p');
  welcome.className = 'welcome';
  welcome.textContent =
    '汇见已安装。试着拖动选中或双击下面的一笔价格；以后在任意网页都可以这样换算。';
  document.querySelector('header')!.prepend(welcome);
}
const nodes: { node: Text; source: string }[] = [];
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
while (walker.nextNode()) {
  const node = walker.currentNode as Text;
  if (
    !node.parentElement?.closest('script,style,[contenteditable]') &&
    /[\u3400-\u9fff]/.test(node.data)
  )
    nodes.push({ node, source: node.data });
}
const select = document.createElement('select');
select.className = 'practice-language';
for (const [value, label] of [
  ['system', 'Browser / 浏览器'],
  ['en', 'English'],
  ['zh-CN', '简体中文'],
]) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.append(option);
}
document.querySelector('header')!.prepend(select);
function render(settings: Settings) {
  setLanguage(settings.language || 'system');
  select.value = settings.language || 'system';
  select.setAttribute('aria-label', t('界面语言'));
  document.documentElement.lang = getLanguage();
  document.title =
    getLanguage() === 'en' ? 'RateGlide · Selection playground' : 'RateGlide · 汇见划词练习场';
  for (const { node, source } of nodes) {
    const translated = t(source);
    // HTML formatters may insert line breaks inside Chinese paragraphs.
    // Normalize only this owned practice-page copy, not prices or query data.
    const normalized = source
      .replace(/\s+/g, ' ')
      .replace(/([\u3400-\u9fff。；，、]) (?=[\u3400-\u9fff])/g, '$1')
      .trim();
    node.data =
      getLanguage() === 'en' && /[\u3400-\u9fff]/.test(translated) ? t(normalized) : translated;
  }
  const input = document.querySelector('input');
  input?.setAttribute('aria-label', t('不会触发的输入框'));
  document.querySelector('[contenteditable]')?.setAttribute('aria-label', t('可编辑内容'));
  markHomeCurrency(settings);
}
// Prices already in the home currency do not prompt, so label them instead of leaving
// a first selection looking broken.
function markHomeCurrency(settings: Settings) {
  document.querySelectorAll('.home-tag').forEach((tag) => tag.remove());
  for (const price of document.querySelectorAll<HTMLElement>('.price, td[id$="-format"]')) {
    // Read prices the way the selection helper does, including the page language.
    const context = {
      lang: price.closest('[lang]')?.getAttribute('lang') ?? '',
      host: location.hostname,
    };
    if (parseMoney(price.textContent || '', settings, context)?.currency !== settings.target)
      continue;
    const tag = document.createElement('span');
    tag.className = 'home-tag';
    tag.textContent = t('目标货币 · 不提示');
    if (price.matches('td')) price.nextElementSibling?.append(tag);
    else price.after(tag);
  }
}
select.addEventListener('change', async () => {
  try {
    render(
      await rpc<Settings>({
        type: 'saveSettings',
        patch: { language: select.value as LanguagePreference },
      }),
    );
  } catch {
    select.setAttribute('aria-label', t('保存失败，请重试'));
  }
});
void rpc<Settings>({ type: 'settings' }).then(render);
ext?.storage.onChanged.addListener((changes) => {
  if (changes.settings?.newValue) render(changes.settings.newValue as Settings);
});

// Extension pages load the same selection helper explicitly. Ordinary pages use the manifest.
if (ext) {
  const script = document.createElement('script');
  script.src = ext.runtime.getURL('content.js');
  document.head.append(script);
}
