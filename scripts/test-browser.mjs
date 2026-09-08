import * as pw from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = '/tmp/huijian-qa';
await fs.mkdir(out, { recursive: true });
const profile = await fs.mkdtemp('/tmp/huijian-qa-profile-');
const extension = process.cwd() + '/release/chromium';
const checks = [];
const errors = [];
const check = (name, condition, detail = '') => {
  checks.push({ name, pass: !!condition, detail });
  if (!condition) throw new Error(name + ' ' + detail);
  console.log('PASS', name);
};
const context = await pw.chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  locale: 'zh-CN',
  headless: true,
  args: ['--disable-extensions-except=' + extension, '--load-extension=' + extension],
  viewport: { width: 400, height: 600 },
  colorScheme: 'light',
});
try {
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const id = sw.url().split('/')[2];
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`chrome-extension://${id}/popup.html?popup=1`);
  await page.getByLabel('兑换金额', { exact: true }).waitFor();
  const rpc = async (m) => page.evaluate((m) => chrome.runtime.sendMessage(m), m);
  let live = await rpc({ type: 'quote', from: 'USD', to: 'CNY', source: 'wise' });
  check(
    'real extension service worker live Wise fetch',
    live.ok && live.data.rate > 0,
    JSON.stringify(live),
  );
  const market = await rpc({ type: 'market' });
  check('broad currency data loads', market.ok && Object.keys(market.data.rates).length >= 150);
  console.log('LIVE CURRENCY COUNT', Object.keys(market.data.rates).length);
  const boc = await rpc({ type: 'quote', from: 'USD', to: 'CNY', source: 'boc' });
  check('real BOC bank quote loads', boc.ok && boc.data.rate > 0);
  const comp = await rpc({ type: 'compare', from: 'GBP', to: 'EUR', amount: 1000 });
  check(
    'live comparison includes HSBC and PayPal',
    comp.ok &&
      comp.data.some((r) => r.name === 'HSBC') &&
      comp.data.some((r) => r.name === 'PayPal'),
  );
  await fs.writeFile(
    out + '/live-data-summary.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        wise: live.data,
        boc: boc.data,
        currencyCount: Object.keys(market.data.rates).length,
        comparisonProviders: [...new Set(comp.data.map((r) => r.name))],
      },
      null,
      2,
    ),
  );
  await page.waitForFunction(() => !!document.querySelector('output')?.textContent?.match(/[0-9]/));
  check('popup title', (await page.title()) === 'RateGlide · 汇见 · 随手换算');
  check(
    'popup stays within 400 x 600',
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth === 400 &&
        document.documentElement.scrollHeight <= 600,
    ),
  );
  await page.screenshot({ animations: 'disabled', path: out + '/popup-light.png' });
  await page.setViewportSize({ width: 166, height: 600 });
  check(
    'native popup minimum width survives narrow initial viewport',
    await page
      .locator('html')
      .evaluate((e) => getComputedStyle(e).minWidth === '400px' && e.scrollWidth === 400),
  );
  await page.setViewportSize({ width: 400, height: 600 });
  await page.getByLabel('兑换金额', { exact: true }).fill('129.00');
  const result = await page.getByLabel('换算结果', { exact: true }).innerText();
  check(
    'amount edit recomputes immediately',
    Math.abs(Number(result.replaceAll(',', '')) - 129 * live.data.rate) < 2,
  );
  await page.getByRole('button', { name: '复制换算结果', exact: true }).click();
  await page.getByRole('button', { name: '已复制', exact: true }).waitFor({ timeout: 5000 });
  check('copy success feedback', true);
  await page.getByLabel('原币种', { exact: true }).click();
  await page.getByLabel('搜索币种', { exact: true }).fill('日元');
  await page.getByRole('button', { name: /日元 Japanese Yen JPY/ }).click();
  check(
    'currency search changes original currency',
    await page
      .getByLabel('原币种', { exact: true })
      .innerText()
      .then((t) => t.includes('JPY')),
  );
  await page.getByRole('button', { name: '交换币种', exact: true }).click();
  check(
    'swap keeps direction consistent',
    await page
      .getByLabel('原币种', { exact: true })
      .innerText()
      .then((t) => t.includes('CNY')),
  );
  await page.getByLabel('兑换金额', { exact: true }).fill('not a number');
  check(
    'invalid amount disabled comparison',
    !(await page.getByRole('button', { name: '比较这笔兑换', exact: true }).isEnabled()),
  );
  check(
    'invalid amount displays dash',
    (await page.getByLabel('换算结果', { exact: true }).innerText()) === '—',
  );
  await page.getByLabel('兑换金额', { exact: true }).fill('1000');
  await page.getByRole('button', { name: '关注', exact: true }).click();
  check(
    'watchlist renders',
    await page.getByRole('heading', { name: '关注的货币', exact: true }).isVisible(),
  );
  await page.getByLabel('添加关注币种', { exact: true }).click();
  await page.getByLabel('搜索币种', { exact: true }).fill('AUD');
  await page.getByRole('button', { name: /澳大利亚元|澳元/ }).click();
  await page.getByRole('button', { name: '添加关注', exact: true }).click();
  check('favorite persisted', (await rpc({ type: 'settings' })).data.favorites.includes('AUD'));
  await page.getByLabel('取消关注 AUD', { exact: true }).click();
  check(
    'favorite removal persisted',
    !(await rpc({ type: 'settings' })).data.favorites.includes('AUD'),
  );
  await page.goto(
    `chrome-extension://${id}/popup.html?popup=1&tab=compare&from=GBP&to=EUR&amount=1000`,
  );
  await page.locator('.compare-row').first().waitFor({ timeout: 25000 });
  check('comparison renders returned providers', (await page.locator('.compare-row').count()) > 5);
  await page.getByRole('button', { name: '银行', exact: true }).click();
  check(
    'comparison bank filter excludes Wise',
    !(await page
      .locator('.provider-title b')
      .allTextContents()
      .then((t) => t.includes('Wise'))),
  );
  await page.screenshot({ animations: 'disabled', path: out + '/comparison.png' });
  await page.goto(`chrome-extension://${id}/options.html`);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('heading', { name: '让每一次兑换，心中有数。' }).waitFor();
  await page.screenshot({ animations: 'disabled', path: out + '/settings.png' });
  await page.getByLabel('外观', { exact: true }).selectOption('dark');
  check('theme persisted', (await rpc({ type: 'settings' })).data.theme === 'dark');
  await page.screenshot({ animations: 'disabled', path: out + '/settings-dark.png' });
  await page.getByLabel('外观', { exact: true }).selectOption('light');
  await page.getByLabel('屏蔽网站域名', { exact: true }).fill('example.com');
  await page.getByRole('button', { name: '添加网站', exact: true }).click();
  check(
    'site block persists',
    (await rpc({ type: 'settings' })).data.blockedSites.includes('example.com'),
  );
  await page.getByLabel('移除屏蔽 example.com', { exact: true }).click();
  check(
    'site block removal persists',
    !(await rpc({ type: 'settings' })).data.blockedSites.includes('example.com'),
  );
  await page.getByRole('button', { name: '数据来源', exact: true }).click();
  await page.getByLabel('搜索银行和平台', { exact: true }).fill('Visa');
  check('provider search isolates Visa', (await page.locator('.directory>button').count()) === 1);
  await page.getByLabel('搜索银行和平台', { exact: true }).fill('');
  check(
    'no manual card rate input remains',
    (await page
      .getByLabel('\u624b\u52a8\u586b\u5199\u5361\u7ec4\u7ec7\u6c47\u7387', { exact: true })
      .count()) === 0,
  );
  await page.locator('.settings-main').evaluate((e) => (e.scrollTop = 0));
  await page.screenshot({ animations: 'disabled', path: out + '/sources.png', fullPage: true });
  for (const width of [375, 620, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    check(
      `settings no horizontal overflow at ${width}`,
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    );
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: '偏好设置', exact: true }).click();
  await page.screenshot({ animations: 'disabled', path: out + '/settings-mobile.png' });
  await page.setViewportSize({ width: 1200, height: 850 });
  const practice = await context.newPage();
  practice.on('pageerror', (e) => errors.push(e.message));
  await practice.setViewportSize({ width: 1200, height: 850 });
  await practice.goto('http://127.0.0.1:4173/practice.html');
  async function select(selector) {
    await practice.locator(selector).scrollIntoViewIfNeeded();
    await practice.evaluate((sel) => {
      const e = document.querySelector(sel);
      const r = document.createRange();
      r.selectNodeContents(e);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }, selector);
    await practice
      .locator(selector)
      .dispatchEvent('pointerup', { button: 0, clientX: 400, clientY: 250 });
  }
  // Verify one true mouse drag before deterministic format regressions.
  const b = await practice.locator('#price-usd').boundingBox();
  await practice.mouse.move(b.x, b.y + b.height / 2);
  await practice.mouse.down();
  await practice.mouse.move(b.x + b.width + 2, b.y + b.height / 2, { steps: 15 });
  await practice.mouse.up();
  await practice.getByRole('button', { name: '换算为 CNY', exact: true }).waitFor();
  check('real cursor text selection opens prompt', true);
  await practice.getByRole('button', { name: '换算为 CNY', exact: true }).click();
  await practice.locator('huijian-helper .result').filter({ hasText: /[0-9]/ }).waitFor();
  check(
    'content live conversion displays result',
    await practice
      .locator('huijian-helper .result')
      .innerText()
      .then((t) => t.includes('CNY')),
  );
  check(
    'ambiguous dollar disclosure',
    await practice
      .locator('huijian-helper .hint')
      .innerText()
      .then((t) => t.includes('USD')),
  );
  await practice.screenshot({ animations: 'disabled', path: out + '/selection.png' });
  await practice.keyboard.press('Escape');
  check('Escape closes floating panel', (await practice.locator('huijian-helper').count()) === 0);
  for (const sel of [
    '#eu-format',
    '#cn-format',
    '#in-format',
    '#ch-format',
    '#kr-format',
    '#th-format',
  ]) {
    await select(sel);
    await practice.getByRole('button', { name: '换算为 CNY', exact: true }).waitFor();
    check('selection format ' + sel, true);
    await practice.keyboard.press('Escape');
  }
  for (const sel of ['#no-price', '#date', '#range']) {
    await select(sel);
    await practice.waitForTimeout(150);
    check('no false positive ' + sel, (await practice.locator('huijian-helper').count()) === 0);
  }
  await practice.getByLabel('不会触发的输入框').focus();
  await practice.keyboard.press('Meta+A');
  await practice.getByLabel('不会触发的输入框').dispatchEvent('pointerup', { button: 0 });
  await practice.waitForTimeout(100);
  check('input fields are ignored', (await practice.locator('huijian-helper').count()) === 0);
  await rpc({ type: 'saveSettings', patch: { enabled: false } });
  await practice.locator('h1').click();
  await select('#price-usd');
  await practice.waitForTimeout(120);
  check(
    'global disable takes effect without reload',
    (await practice.locator('huijian-helper').count()) === 0,
  );
  await rpc({ type: 'saveSettings', patch: { enabled: true, mode: 'instant' } });
  await select('#price-usd');
  await practice.locator('huijian-helper .result').waitFor();
  check('instant conversion mode works', true);
  await practice.keyboard.press('Escape');
  await rpc({ type: 'saveSettings', patch: { mode: 'prompt', blockedSites: ['127.0.0.1:4173'] } });
  await select('#price-hkd');
  await practice.waitForTimeout(120);
  check('site exclusion prevents prompt', (await practice.locator('huijian-helper').count()) === 0);
  await rpc({ type: 'saveSettings', patch: { blockedSites: [] } });
  await practice.setViewportSize({ width: 375, height: 667 });
  await select('#cn-format');
  await practice.getByRole('button', { name: '换算为 CNY', exact: true }).click();
  await practice.locator('huijian-helper .result').filter({ hasText: /[0-9]/ }).waitFor();
  const rect = await practice.locator('huijian-helper .panel').boundingBox();
  check(
    'selection panel fits small viewport',
    rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 375 && rect.y + rect.height <= 667,
  );
  await practice.screenshot({ animations: 'disabled', path: out + '/selection-mobile.png' });
  await practice.keyboard.press('Escape');
  await practice.setViewportSize({ width: 1200, height: 850 });
  await practice.goto(`chrome-extension://${id}/practice.html`);
  await select('#price-usd');
  await practice.getByRole('button', { name: '换算为 CNY', exact: true }).waitFor();
  await practice.getByRole('button', { name: '换算为 CNY', exact: true }).click();
  await practice.locator('huijian-helper .result').filter({ hasText: /[0-9]/ }).waitFor();
  check('built-in practice page converts without a local server', true);
  await practice.screenshot({ animations: 'disabled', path: out + '/practice-built-in.png' });
  check('no runtime page errors', errors.length === 0, JSON.stringify(errors));
  await fs.writeFile(out + '/checks.json', JSON.stringify(checks, null, 2));
  console.log(`TOTAL ${checks.length} browser checks passed`);
} catch (e) {
  for (const [i, p] of context.pages().entries()) {
    try {
      await p.screenshot({ animations: 'disabled', path: out + '/failure-' + i + '.png' });
      console.log('FAILURE PAGE', await p.locator('body').innerText());
    } catch {}
  }
  console.error(e);
  await fs.writeFile(
    out + '/checks.json',
    JSON.stringify({ checks, errors, failure: String(e) }, null, 2),
  );
  throw e;
} finally {
  await context.close();
  await fs.rm(profile, { recursive: true, force: true });
}
