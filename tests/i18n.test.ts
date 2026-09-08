import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { english } from '../src/i18n/messages';
import { resolveLanguage, setLanguage, getLanguage, t, translate } from '../src/i18n';
import { cleanSettings } from '../src/core/storage';
import { currencyName } from '../src/data/currencies';
import { SOURCE_LABELS } from '../src/core/providers';
import { directory, countries } from '../src/data/directory';

afterEach(() => setLanguage('system'));
test('browser language detection and explicit overrides', () => {
  for (const locale of ['zh-CN', 'zh-TW', 'zh_HK', 'zh'])
    assert.equal(resolveLanguage('system', locale), 'zh-CN');
  for (const locale of ['en-US', 'en-GB', 'fr-FR', 'de', 'ja'])
    assert.equal(resolveLanguage('system', locale), 'en');
  assert.equal(resolveLanguage('en', 'zh-CN'), 'en');
  assert.equal(resolveLanguage('zh-CN', 'en-US'), 'zh-CN');
});
test('language migration retains user currency and existing settings', () => {
  const settings = cleanSettings({
    target: 'JPY',
    favorites: ['EUR', 'SGD'],
    rememberHistory: true,
  });
  assert.equal(settings.language, 'system');
  assert.equal(settings.target, 'JPY');
  assert.deepEqual(settings.favorites, ['EUR', 'SGD']);
  assert.equal(settings.rememberHistory, true);
  assert.equal(cleanSettings({ language: 'bad' as any }).language, 'system');
});
test('changing language does not freeze currency names at module initialization', () => {
  setLanguage('en');
  assert.equal(currencyName('USD'), 'US Dollar');
  assert.equal(t('刷卡'), 'Cards');
  setLanguage('zh-CN');
  assert.equal(currencyName('USD'), '美元');
  assert.equal(t('刷卡'), '刷卡');
});
test('cached dynamic errors and notices translate without changing amounts', () => {
  setLanguage('en');
  assert.equal(t('来源暂不可用（403）'), 'The provider is temporarily unavailable (403).');
  assert.equal(
    t('$ 按 USD 识别，可修改币种'),
    '$ is assumed to be USD. You can change the currency.',
  );
  assert.equal(t('未包含货币符号，按 JPY 识别'), 'No currency symbol. Using JPY.');
  assert.equal(t('Visa 汇率数据缺失'), 'Missing Visa rate data.');
  assert.equal(t('复制 {0} 账单', ['Visa']), 'Copy Visa bill');
  assert.equal(t('换算为 {0}', ['USD']), 'Convert to USD');
  assert.ok(
    !/[\u3400-\u9fff]/.test(
      t('Wise 暂不可用或不支持此币种，已使用每日参考价。每日更新，不是盘中实时价格；不含手续费。'),
    ),
  );
});
test('source labels, provider descriptions, categories and countries have English translations', () => {
  setLanguage('en');
  for (const text of [
    ...Object.values(SOURCE_LABELS),
    ...directory.flatMap((p) => [p.name, p.note, p.category]),
    ...countries.map((c) => c[1]),
  ])
    assert.ok(!/[\u3400-\u9fff]/.test(t(text)), text);
});
test('English templates retain every interpolation slot exactly once', () => {
  for (const [source, target] of Object.entries(english))
    assert.deepEqual(
      (source.match(/\{\d+\}/g) || []).sort(),
      (target.match(/\{\d+\}/g) || []).sort(),
      source,
    );
});
test('Chinese and unknown diagnostic messages remain intact', () => {
  const text = '卡组织返回的汇率与金额不一致';
  assert.equal(translate(text, 'zh-CN'), text);
  setLanguage('en');
  assert.equal(t('Network request failed'), 'Network request failed');
  assert.equal(t('1 USD = 0.85 EUR'), '1 USD = 0.85 EUR');
});
