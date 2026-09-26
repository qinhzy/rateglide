import { webkit } from 'playwright';
import fs from 'node:fs/promises';

const out = '/tmp/huijian-qa';
await fs.mkdir(out, { recursive: true });
const browser = await webkit.launch({ headless: true });
const page = await browser.newPage({ locale: 'zh-CN', viewport: { width: 400, height: 600 } });
const errors = [];
const checks = [];
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.error('WEBKIT PAGE ERROR', e.stack);
});
function check(name, condition) {
  checks.push({ name, pass: !!condition });
  if (!condition) throw new Error(name);
  console.log('PASS', name);
}
try {
  await page.goto('http://127.0.0.1:4173/popup.html');
  await page.getByLabel('兑换金额', { exact: true }).fill('129.00');
  check(
    'WebKit popup renders',
    await page.getByRole('button', { name: '比较这笔兑换', exact: true }).isVisible(),
  );
  await page.getByLabel('原币种', { exact: true }).click();
  await page.getByLabel('搜索币种', { exact: true }).fill('EUR');
  await page.getByRole('option', { name: /欧元 Euro EUR/ }).click();
  check(
    'WebKit searchable currency picker',
    (await page.getByLabel('原币种', { exact: true }).innerText()).includes('EUR'),
  );
  await page.getByLabel('兑换金额', { exact: true }).fill('bad');
  check(
    'WebKit invalid amount state',
    (await page.getByLabel('换算结果', { exact: true }).innerText()) === '—',
  );
  // Let the preview request settle before destroying the page; Safari extension
  // requests run in a separate background context, unlike this web preview.
  await page.locator('.source-meta, .error-box').first().waitFor({ timeout: 25000 });
  await page.goto('http://127.0.0.1:4173/options.html');
  await page.getByRole('heading', { name: '让每一次兑换，心中有数。' }).waitFor();
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    check(
      `WebKit settings fit ${width}px`,
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    );
  }
  await page.getByLabel('外观', { exact: true }).selectOption('dark');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  check('WebKit dark theme', (await page.locator('html').getAttribute('data-theme')) === 'dark');
  await page.screenshot({ path: out + '/webkit-settings.png', animations: 'disabled' });
  await page.getByLabel('界面语言', { exact: true }).selectOption('en');
  await page.getByRole('heading', { name: 'Know your rate. Keep your bearings.' }).waitFor();
  check(
    'WebKit switches preferences to English',
    (await page.locator('html').getAttribute('lang')) === 'en',
  );
  for (const width of [375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    check(
      `WebKit English settings fit ${width}px`,
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    );
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({ path: out + '/webkit-english-mobile.png', animations: 'disabled' });
  check('WebKit no runtime errors', errors.length === 0);
  await fs.writeFile(out + '/webkit-checks.json', JSON.stringify(checks, null, 2));
  console.log(
    `TOTAL ${checks.length} WebKit renderer checks passed (not a Safari extension install test)`,
  );
} finally {
  await browser.close();
}
