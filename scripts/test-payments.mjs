import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out = '/tmp/huijian-qa';
await fs.mkdir(out, { recursive: true });
const profile = await fs.mkdtemp('/tmp/huijian-payments-');
const extension = process.cwd() + '/release/chromium';
const checks = [],
  errors = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass: !!pass, detail });
  if (!pass) throw new Error(name + ' ' + detail);
  console.log('PASS', name);
};
// Official calculator endpoints reject headless clients. Use an ordinary headed
// Chromium extension with its default browser identity; no stealth or cookie import.
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  locale: 'zh-CN',
  headless: false,
  args: ['--disable-extensions-except=' + extension, '--load-extension=' + extension],
  viewport: { width: 400, height: 600 },
});
try {
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const id = sw.url().split('/')[2];
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    `chrome-extension://${id}/popup.html?popup=1&tab=cards&amount=100&from=USD&to=CNY`,
  );
  const rpc = (m) => page.evaluate((m) => chrome.runtime.sendMessage(m), m);
  const waitCards = async () => {
    await page.getByLabel('Visa 预计账单', { exact: true }).waitFor({ timeout: 25000 });
    await page.getByLabel('Mastercard 预计账单', { exact: true }).waitFor({ timeout: 25000 });
  };
  await waitCards();
  check('both official card quotes render in extension', true);
  const raw = {};
  for (const network of ['visa', 'mastercard']) {
    const r = await rpc({
      type: 'card',
      input: { network, from: 'USD', to: 'CNY', amount: 100, date: '', bankFee: 0 },
    });
    check(
      network + ' actual official rate and direction',
      r.ok &&
        r.data.from === 'USD' &&
        r.data.to === 'CNY' &&
        r.data.baseRate > 5 &&
        r.data.baseRate < 9,
      JSON.stringify(r),
    );
    raw[network] = r.data;
  }
  check(
    'no external navigation required for cards',
    (await page.locator('.cards-view a[href^="http"]').count()) === 0,
  );
  check(
    'popup frame remains 400 by 600',
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth === 400 &&
        document.documentElement.scrollHeight === 600,
    ),
  );
  await page.screenshot({ path: out + '/cards.png', animations: 'disabled' });
  await page.locator('.popup>main').evaluate((e) => (e.scrollTop = e.scrollHeight));
  await page.screenshot({ path: out + '/cards-results.png', animations: 'disabled' });
  await page.getByLabel('发卡行附加费', { exact: true }).fill('1.5');
  await waitCards();
  for (const network of ['visa', 'mastercard']) {
    const r = await rpc({
      type: 'card',
      input: { network, from: 'USD', to: 'CNY', amount: 100, date: '', bankFee: 1.5 },
    });
    check(
      network + ' live fee applied exactly once',
      r.ok && Math.abs(r.data.total - r.data.baseRate * 100 * 1.015) < 0.001,
      JSON.stringify(r),
    );
  }
  await page.getByLabel('复制 Visa 账单', { exact: true }).click();
  await page.getByLabel('账单已复制', { exact: true }).waitFor();
  check('card bill copy feedback', true);
  await page.getByLabel('刷卡日期模式', { exact: true }).selectOption('custom');
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  await page.getByLabel('刷卡交易日期', { exact: true }).fill(yesterday);
  await waitCards();
  check(
    'historical dates shown from provider',
    await page
      .locator('.network-date time')
      .allTextContents()
      .then((a) => a.length === 2 && a.every((x) => x <= yesterday)),
  );
  await page.getByLabel('发卡行附加费', { exact: true }).fill('NaN');
  await page.getByRole('alert').filter({ hasText: '附加费应为' }).waitFor();
  check(
    'invalid fee clears numeric card results',
    (await page.locator('.network-total output').count()) === 0,
  );
  await page.getByLabel('发卡行附加费', { exact: true }).fill('0');
  await page.getByLabel('刷卡日期模式', { exact: true }).selectOption('latest');
  await page.getByLabel('交换刷卡币种', { exact: true }).click();
  await waitCards();
  check(
    'reverse CNY to USD remains correct',
    await page
      .getByLabel('Visa 预计账单', { exact: true })
      .innerText()
      .then((t) => t.includes('USD') && parseFloat(t) > 10 && parseFloat(t) < 20),
  );
  await page.getByLabel('交换刷卡币种', { exact: true }).click();
  await waitCards();
  await context.setOffline(true);
  await page.getByLabel('刷新卡组织报价', { exact: true }).click();
  await waitCards();
  await page.locator('.network-quote .warning').first().waitFor({ timeout: 15000 });
  check(
    'offline card quote is clearly cached',
    (await page.locator('.network-quote .warning').count()) === 2,
  );
  const missing = await rpc({
    type: 'card',
    input: { network: 'visa', from: 'CHF', to: 'JPY', amount: 137, date: '', bankFee: 0 },
  });
  check('uncached offline cards never fall back to market', !missing.ok);
  await context.setOffline(false);
  await page.getByLabel('刷新卡组织报价', { exact: true }).click();
  await waitCards();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.network-total output').length === 2 &&
      document.querySelectorAll('.network-quote .warning').length === 0,
  );
  check(
    'card recovery removes stale warning',
    (await page.locator('.network-quote .warning').count()) === 0,
  );
  await page.goto(
    `chrome-extension://${id}/popup.html?popup=1&tab=compare&amount=100&from=USD&to=CNY`,
  );
  await page.locator('.revolut-result strong').waitFor({ timeout: 25000 });
  const rev = await rpc({ type: 'revolut', from: 'JPY', to: 'CNY', amount: 10000, country: 'GB' });
  check(
    'Revolut JPY units and live fees validated',
    rev.ok &&
      rev.data.amount === 10000 &&
      rev.data.received > 300 &&
      rev.data.received < 700 &&
      rev.data.plans.length > 0,
    JSON.stringify(rev),
  );
  raw.revolut = rev.data;
  await page.getByLabel('Revolut 账户地区', { exact: true }).selectOption('SG');
  await page.locator('.revolut-result strong').waitFor({ timeout: 25000 });
  check(
    'Revolut region can be switched',
    (await page.getByLabel('Revolut 账户地区', { exact: true }).inputValue()) === 'SG',
  );
  check(
    'comparison has no external quote links',
    (await page.locator('.comparison a[href^="http"]').count()) === 0,
  );
  await page.screenshot({ path: out + '/revolut.png', animations: 'disabled' });
  await page.goto(`chrome-extension://${id}/options.html#sources`);
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.getByLabel('搜索银行和平台').fill('HSBC');
  await page.locator('.directory>button').click();
  await page.locator('.provider-workspace .compare-row').waitFor({ timeout: 25000 });
  check(
    'HSBC is queried inside settings',
    await page
      .locator('.provider-workspace .provider-title b')
      .allTextContents()
      .then((a) => a.length > 0 && a.every((x) => x === 'HSBC')),
  );
  await page.getByLabel('搜索银行和平台').fill('PayPal');
  await page.locator('.directory>button').click();
  await page
    .locator('.provider-workspace .provider-title b')
    .filter({ hasText: 'PayPal' })
    .waitFor({ timeout: 25000 });
  check('PayPal is queried inside settings', true);
  await page.getByLabel('搜索银行和平台').fill('Visa');
  await page.locator('.directory>button').click();
  await waitCards();
  check('source directory opens live card calculator in place', true);
  await page.locator('.provider-workspace').scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + '/cards-settings.png', animations: 'disabled' });
  for (const width of [375, 620, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    check(
      'inline card workspace fits ' + width,
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    );
  }
  const external = context.pages().filter((p) => /^https?:/.test(p.url()));
  check('all UI queries stayed within extension', external.length === 0);
  await fs.writeFile(
    out + '/payment-live-data.json',
    JSON.stringify({ checkedAt: new Date().toISOString(), ...raw }, null, 2),
  );
  check('no payment UI runtime errors', errors.length === 0, JSON.stringify(errors));
  console.log('PAYMENTS TOTAL', checks.length);
} catch (e) {
  console.error(e);
  const page = context.pages().at(-1);
  if (page) await page.screenshot({ path: out + '/payments-failure.png', animations: 'disabled' });
  process.exitCode = 1;
} finally {
  await fs.writeFile(out + '/payment-checks.json', JSON.stringify({ checks, errors }, null, 2));
  await context.close();
  await fs.rm(profile, { recursive: true, force: true });
}
