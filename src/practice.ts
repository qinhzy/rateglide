import { getLanguage, setLanguage, t, type LanguagePreference } from './i18n';
import { rpc } from './core/client';
import { ext } from './core/storage';
import type { Settings } from './core/types';

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
