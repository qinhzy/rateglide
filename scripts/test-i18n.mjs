import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

// Deterministic extension tests: provider responses are fixtures, never live quotes.
const out = process.env.RATEGLIDE_QA_DIR || path.join(os.tmpdir(), 'rateglide-qa');
await fs.mkdir(out, { recursive: true });
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'rateglide-i18n-'));
const extension = path.resolve('release/chromium');
const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(
    '<!doctype html><html lang="en"><title>RateGlide test price</title><body style="padding:80px;font:24px system-ui"><p id="home">US$ 129.00</p><p id="price">€ 129.00</p><p>Ticket <span id="dbl">€35.50</span></p><p>Sale <span id="sup">€129<sup>99</sup></span></p><p lang="zh-CN">京东价 <span id="yuan">￥899.00</span></p><p>Ordinary text is not a price.</p><div id="wide" style="width:600px;overflow-x:auto"><div style="width:2400px"><span id="wide-price">€ 42.00</span></div></div></body></html>',
  );
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: true,
  locale: 'en-US',
  args: ['--disable-extensions-except=' + extension, '--load-extension=' + extension],
  viewport: { width: 400, height: 600 },
});
const checks = [],
  errors = [];
const check = (name, pass = true) => {
  assert.ok(pass, name);
  checks.push(name);
  console.log('PASS', name);
};
context.on('page', (p) => p.on('pageerror', (error) => errors.push(error.message)));
let page;
try {
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  await sw.evaluate(() => {
    const rates = {
      USD: 1,
      EUR: 0.9,
      CNY: 7.2,
      JPY: 150,
      GBP: 0.8,
      HKD: 7.8,
      SGD: 1.3,
      CAD: 1.4,
      AUD: 1.5,
      CHF: 0.9,
    };
    globalThis.__rateGlideFailure = false;
    globalThis.fetch = async (input) => {
      const url = new URL(String(input)),
        p = url.searchParams,
        now = Date.now();
      if (globalThis.__rateGlideFailure) return new Response('Unavailable', { status: 503 });
      if (url.hostname === 'wise.com') {
        const source = p.get('source'),
          target = p.get('target');
        return Response.json({
          source,
          target,
          value: (rates[target] || 1) / (rates[source] || 1),
          time: now,
        });
      }
      if (url.hostname === 'open.er-api.com')
        return Response.json({
          result: 'success',
          base_code: 'USD',
          rates,
          time_last_update_unix: Math.floor(now / 1000),
          time_next_update_unix: Math.floor(now / 1000) + 86400,
        });
      if (url.hostname === 'api.wise.com') {
        const from = p.get('sourceCurrency'),
          to = p.get('targetCurrency'),
          amount = Number(p.get('sendAmount')),
          rate = (rates[to] || 1) / (rates[from] || 1);
        return Response.json({
          sourceCurrency: from,
          targetCurrency: to,
          amount,
          providers: [
            ['HSBC', 'bank', 10],
            ['PayPal', 'transfer', 20],
            ['Wise', 'transfer', 5],
          ].map(([name, type, fee]) => ({
            name,
            type,
            alias: name.toLowerCase(),
            quotes: [
              {
                rate,
                fee,
                receivedAmount: (amount - fee) * rate,
                dateCollected: new Date(now).toISOString(),
                sourceCountry: 'GB',
                targetCountry: 'DE',
              },
            ],
          })),
        });
      }
      if (url.hostname === 'www.visa.co.uk') {
        const from = p.get('toCurr'),
          to = p.get('fromCurr'),
          amount = Number(p.get('amount')),
          fee = Number(p.get('fee')),
          base = (rates[to] || 1) / (rates[from] || 1),
          rate = base * (1 + fee / 100),
          // The calculator dates its rate by the requested day (MM/DD/YYYY).
          [month, date, year] = p.get('exchangedate').split('/'),
          day = Date.parse(`${year}-${month}-${date}T00:00:00Z`);
        return Response.json({
          status: 'success',
          conversionBankFee: fee,
          originalValues: {
            fromCurrency: from,
            toCurrency: to,
            fromAmount: amount,
            fxRateVisa: base,
            fxRateWithAdditionalFee: rate,
            toAmountWithAdditionalFee: amount * rate,
            asOfDate: Math.floor(day / 1000),
            lastUpdatedVisaRate: Math.floor(now / 1000),
          },
        });
      }
      if (url.hostname === 'www.mastercard.com') {
        const from = p.get('transaction_currency'),
          to = p.get('cardholder_billing_currency'),
          amount = Number(p.get('transaction_amount')),
          fee = Number(p.get('bank_fee')),
          base = (rates[to] || 1) / (rates[from] || 1),
          rate = base * 1.001 * (1 + fee / 100);
        return Response.json({
          data: {
            conversionRate: rate,
            crdhldBillAmt: amount * rate,
            crdhldBillCurr: to,
            fxDate:
              p.get('exchange_date') === '0000-00-00'
                ? new Date(now).toISOString().slice(0, 10)
                : p.get('exchange_date'),
            transAmt: amount,
            transCurr: from,
            bankFee: fee,
          },
        });
      }
      if (url.hostname === 'www.revolut.com') {
        const from = p.get('fromCurrency'),
          to = p.get('toCurrency'),
          amount = Number(p.get('amount')),
          rate = (rates[to] || 1) / (rates[from] || 1),
          scale = (c) =>
            10 **
            new Intl.NumberFormat('en', { style: 'currency', currency: c }).resolvedOptions()
              .maximumFractionDigits;
        return Response.json({
          sender: { amount, currency: from },
          recipient: {
            amount: Math.round((amount / scale(from)) * rate * scale(to)),
            currency: to,
          },
          rate: { from, to, rate, timestamp: now },
          plans: [
            {
              id: 'standard',
              name: 'Standard',
              fees: {
                total: { amount: 10, currency: from },
                cost: { amount: amount + 10, currency: from },
              },
            },
          ],
        });
      }
      return new Response('Fixture unavailable', { status: 503 });
    };
  });
  const id = sw.url().split('/')[2],
    base = `chrome-extension://${id}/`;
  const welcomed = () => context.pages().some((p) => p.url().includes('practice.html?welcome=1'));
  for (let i = 0; i < 50 && !welcomed(); i++) await new Promise((r) => setTimeout(r, 100));
  check('a new installation opens the practice page', welcomed());
  page = await context.newPage();
  const rpc = (m) => page.evaluate((m) => chrome.runtime.sendMessage(m), m);
  const noHan = async (p, label) => {
    const text = await p.locator('body').innerText();
    assert.ok(
      // Price examples such as 1,980円 stay in their original notation.
      !/[\u3400-\u9fff]/.test(text.replace(/Browser \/ 浏览器|简体中文|中文|1,980円/g, '')),
      label + ' has untranslated text: ' + text.match(/[^\n]*[\u3400-\u9fff][^\n]*/g),
    );
    check(label);
  };
  const fits = async (p, width, label) =>
    check(label, await p.evaluate((w) => document.documentElement.scrollWidth <= w, width));
  await page.goto(base + 'popup.html?popup=1');
  await page
    .getByLabel('Conversion result', { exact: true })
    .filter({ hasText: /[0-9]/ })
    .waitFor();
  check(
    'English follows browser on first launch',
    (await page.locator('html').getAttribute('lang')) === 'en',
  );
  check(
    'English first run uses USD home currency',
    (await rpc({ type: 'settings' })).data.target === 'USD',
  );
  check(
    'page identity and brand',
    (await page.title()) === 'RateGlide · Currency at your cursor' &&
      (await page.locator('.brand b').innerText()) === 'RateGlide',
  );
  check(
    'popup height stays at 600',
    await page.evaluate(() => document.documentElement.scrollHeight === 600),
  );
  await noHan(page, 'English converter and provider metadata');
  await fits(page, 400, 'English popup fits 400px');
  await page.screenshot({ path: path.join(out, 'english-converter.png'), animations: 'disabled' });
  await page.locator('.other-chip').first().waitFor();
  check('the converter shows the amount in watched currencies');
  await page.getByLabel('From currency', { exact: true }).click();
  check(
    'the popup currency sheet names the field being edited',
    (await page.locator('.currency-menu-title').innerText()) === 'From currency',
  );
  await page.getByLabel('Search currencies', { exact: true }).fill('japan');
  await page.getByLabel('Search currencies', { exact: true }).press('Enter');
  check(
    'currency search ranks country names and accepts Enter',
    (await page.getByLabel('From currency', { exact: true }).innerText()).includes('JPY'),
  );
  await page.getByLabel('From currency', { exact: true }).click();
  await page.getByLabel('Search currencies', { exact: true }).fill('Canadian');
  await page.locator('.currency-option').filter({ hasText: 'CAD' }).click();
  check(
    'English currency search works',
    await page
      .getByLabel('From currency', { exact: true })
      .innerText()
      .then((t) => t.includes('CAD')),
  );
  await page.getByLabel('Amount to convert', { exact: true }).fill('invalid');
  await page
    .getByText('Enter a valid amount, such as 1,000.50, 1.000,50, or 2.5k.', { exact: true })
    .waitFor();
  check('invalid amount feedback translated');
  await page.getByLabel('Amount to convert', { exact: true }).fill('2.5k');
  await page
    .getByLabel('Conversion result', { exact: true })
    .filter({ hasText: '1,785.71' })
    .waitFor();
  check('amount shorthand converts 2.5k');
  await page.getByLabel('Amount to convert', { exact: true }).fill('100');
  await page.getByLabel('Language', { exact: true }).selectOption('zh-CN');
  await page.getByRole('tab', { name: '刷卡', exact: true }).waitFor();
  check('manual Chinese override updates immediately');
  await page.reload();
  await page.getByRole('tab', { name: '换算', exact: true }).waitFor();
  check('language override survives reload');
  check(
    'the last conversion is remembered',
    (await page.getByLabel('兑换金额', { exact: true }).inputValue()) === '100' &&
      (await page.getByLabel('原币种', { exact: true }).innerText()).includes('CAD'),
  );
  await page.getByLabel('界面语言', { exact: true }).selectOption('en');
  await page.getByRole('tab', { name: 'Cards', exact: true }).click();
  await page.getByLabel('Visa estimated bill', { exact: true }).waitFor();
  await page.getByLabel('Mastercard estimated bill', { exact: true }).waitFor();
  check(
    'the cheaper card is identified',
    (await page.locator('[data-network="visa"] .best-badge').innerText()) === 'Lower' &&
      (await page.locator('.card-difference').innerText()).startsWith('Visa is estimated to cost'),
  );
  await noHan(page, 'English cards, fee labels and dates');
  await page.screenshot({ path: path.join(out, 'english-cards.png'), animations: 'disabled' });
  await page.getByLabel('Bank fee', { exact: true }).fill('1.5');
  await page.locator('[data-network="visa"][data-fee="1.5"]').waitFor();
  check('card quote updates after fee change');
  await page.getByLabel('Copy Visa bill', { exact: true }).click();
  await page.getByLabel('Bill copied', { exact: true }).waitFor();
  check('English card copy feedback');
  await page.getByLabel('Bank fee', { exact: true }).fill('NaN');
  await page.getByRole('alert').filter({ hasText: 'between 0% and 30%' }).waitFor();
  check('English card validation errors');
  await page.getByLabel('Bank fee', { exact: true }).fill('0');
  await page.getByLabel('Visa estimated bill', { exact: true }).waitFor();
  await page.locator('.over-mid').nth(1).waitFor();
  check('card bills show their distance from the live mid-market rate');
  // A past rate compared with today's mid-market rate would count market movement as markup.
  const past = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel('Card rate date mode', { exact: true }).selectOption('custom');
  await page.getByLabel('Card transaction date', { exact: true }).fill(past);
  await page.locator(`[data-network="visa"][data-date="${past}"]`).waitFor();
  await page.locator(`[data-network="mastercard"][data-date="${past}"]`).waitFor();
  check(
    'past card rates are not compared with the live mid-market rate',
    (await page.locator('.over-mid').count()) === 0,
  );
  await page.getByLabel('Card rate date mode', { exact: true }).selectOption('latest');
  await page.locator('.over-mid').nth(1).waitFor();
  await sw.evaluate(() => {
    globalThis.__rateGlideFailure = true;
  });
  await page.getByLabel('Refresh card rates', { exact: true }).click();
  await page
    .getByText('Could not update. This is your last saved quote, not a current rate.', {
      exact: true,
    })
    .first()
    .waitFor();
  await noHan(page, 'English stale-cache warning');
  await sw.evaluate(() => {
    globalThis.__rateGlideFailure = false;
  });
  await page.goto(base + 'popup.html?popup=1&tab=compare&from=GBP&to=EUR&amount=1000');
  await page.locator('.compare-row').first().waitFor();
  await page.locator('.revolut-result').waitFor();
  await page.locator('.total-cost').first().waitFor();
  check(
    'each transfer estimate shows its total cost against the mid-market rate',
    (await page.locator('.total-cost').count()) === (await page.locator('.compare-row').count()),
  );
  check(
    'the route with the most received is marked',
    (await page.locator('.compare-row').first().locator('.best-badge').innerText()) ===
      'Most received' &&
      (await page.locator('.shortfall').count()) ===
        (await page.locator('.compare-row').count()) - 1,
  );
  check(
    'transfer estimates come before the Revolut exchange quote',
    await page.evaluate(
      () =>
        !!(
          document
            .querySelector('.quote-list')
            .compareDocumentPosition(document.querySelector('.revolut-panel')) &
          Node.DOCUMENT_POSITION_FOLLOWING
        ),
    ),
  );
  await noHan(page, 'English comparison, Revolut and source notices');
  await page.getByRole('button', { name: 'Banks', exact: true }).click();
  check(
    'translated bank filter preserves canonical values',
    (await page.locator('.compare-row').count()) === 1 &&
      (await page.locator('.provider-title b').innerText()) === 'HSBC',
  );
  await page.getByRole('button', { name: 'Regions', exact: true }).click();
  await noHan(page, 'English region filters');
  await page.getByRole('tab', { name: 'Watchlist', exact: true }).click();
  await page.locator('.watch-row').first().waitFor();
  await noHan(page, 'English watchlist and currency names');
  // Rows render before their rates arrive; the unit appears with the rates.
  await page.locator('.watch-main').filter({ hasText: '1000 JPY / USD' }).waitFor();
  check('small currencies are quoted per 1,000 units');
  const settings = await context.newPage();
  await settings.goto(base + 'options.html');
  await settings.getByLabel('Language', { exact: true }).waitFor();
  await settings.getByLabel('Language', { exact: true }).selectOption('zh-CN');
  await page.getByRole('tab', { name: '关注', exact: true }).waitFor();
  check('language syncs across open extension pages');
  await settings.getByLabel('界面语言', { exact: true }).selectOption('en');
  await page.getByRole('tab', { name: 'Watchlist', exact: true }).waitFor();
  for (const width of [375, 620, 768, 1280]) {
    await settings.setViewportSize({ width, height: 900 });
    await fits(settings, width, `English preferences fit ${width}px`);
  }
  await noHan(settings, 'English preferences and privacy');
  await settings.setViewportSize({ width: 1100, height: 850 });
  await settings.screenshot({
    path: path.join(out, 'english-settings.png'),
    animations: 'disabled',
  });
  await settings.getByRole('button', { name: 'Sources', exact: true }).click();
  await noHan(settings, 'English sources and provider directory');
  await settings.getByLabel('Search banks and providers', { exact: true }).fill('Bank of China');
  check(
    'provider search accepts English translated names',
    (await settings.locator('.directory>button').count()) === 1,
  );
  await settings.getByLabel('Search banks and providers', { exact: true }).fill('');
  await settings.getByRole('button', { name: 'Guide', exact: true }).click();
  await noHan(settings, 'English guide and installation instructions');
  await settings.getByRole('button', { name: 'History', exact: true }).click();
  await noHan(settings, 'English empty history');
  await settings.getByRole('button', { name: 'Preferences', exact: true }).click();
  await settings.getByLabel('Save conversion history', { exact: true }).click();
  await rpc({
    type: 'addHistory',
    entry: { amount: 100, from: 'USD', to: 'CNY', result: 720, source: '中国银行' },
  });
  await settings.getByRole('button', { name: 'History', exact: true }).click();
  await settings.locator('.history-list').waitFor();
  await noHan(settings, 'cached Chinese history source translated');
  const downloadPromise = settings.waitForEvent('download');
  await settings.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  const csv = await fs.readFile(await download.path(), 'utf8');
  check(
    'English CSV headers and source',
    csv.includes('Time,Amount,From,To,Result,Source') && csv.includes('Bank of China'),
  );
  check(
    'English CSV uses international filename',
    download.suggestedFilename() === 'RateGlide-history.csv',
  );
  await settings.goto(base + 'options.html#not-a-section');
  await settings
    .locator('nav button[aria-current="page"]')
    .filter({ hasText: 'Preferences' })
    .waitFor();
  check('unknown settings sections fall back to Preferences');
  const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'));
  check(
    'settings show the packaged version',
    (await settings.locator('.sidebar-footer span').innerText()) === `RateGlide · v${version}`,
  );
  const practice = await context.newPage();
  await practice.setViewportSize({ width: 1100, height: 700 });
  await practice.goto(origin);
  const dragSelect = async (selector) => {
    const box = await practice.locator(selector).boundingBox();
    await practice.mouse.move(box.x, box.y + box.height / 2);
    await practice.mouse.down();
    await practice.mouse.move(box.x + 200, box.y + box.height / 2, { steps: 18 });
    await practice.mouse.up();
  };
  await dragSelect('#home');
  await practice.waitForTimeout(400);
  check(
    'a price already in the home currency stays quiet',
    (await practice.locator('huijian-helper button').count()) === 0,
  );
  await dragSelect('#price');
  await practice.getByRole('button', { name: 'Convert to USD', exact: true }).waitFor();
  await practice.getByRole('button', { name: 'Convert to USD', exact: true }).click();
  await practice
    .locator('huijian-helper .result')
    .filter({ hasText: /143\.33/ })
    .waitFor();
  check('true mouse selection uses saved English language');
  check(
    'English selection currency labels',
    await practice.getByLabel('From currency', { exact: true }).isVisible(),
  );
  const popupText = await practice.locator('huijian-helper').innerText();
  check(
    'selection popup has English result, source and actions',
    !/[\u3400-\u9fff]/.test(popupText),
  );
  await practice.screenshot({
    path: path.join(out, 'english-selection.png'),
    animations: 'disabled',
  });
  await practice.keyboard.press('Escape');
  await dragSelect('#wide-price');
  await practice.getByRole('button', { name: 'Convert to USD', exact: true }).waitFor();
  await practice.locator('#wide').evaluate((el) => (el.scrollLeft = 1200));
  await practice.waitForFunction(() => !document.querySelector('huijian-helper'), null, {
    timeout: 5000,
  });
  check('popup closes when horizontal scrolling moves the selection out of view');
  await practice.keyboard.press('Escape');
  // A double-click selects only the digits; the currency symbol beside them still counts.
  const dbl = await practice.locator('#dbl').boundingBox();
  await practice.mouse.dblclick(dbl.x + dbl.width * 0.7, dbl.y + dbl.height / 2);
  await practice.getByRole('button', { name: 'Convert to USD', exact: true }).waitFor();
  check('double-clicking a number uses the currency symbol beside it');
  await practice.keyboard.press('Escape');
  await dragSelect('#sup');
  await practice.getByRole('button', { name: 'Convert to USD', exact: true }).click();
  await practice.locator('huijian-helper .original').filter({ hasText: '129.99 EUR' }).waitFor();
  check('superscript cents are read as decimals');
  await practice.keyboard.press('Escape');
  await dragSelect('#yuan');
  await practice.getByRole('button', { name: 'Convert to USD', exact: true }).click();
  await practice.locator('huijian-helper .original').filter({ hasText: '899.00 CNY' }).waitFor();
  check(
    '¥ in a Chinese-language section is read as CNY and explained',
    (await practice.locator('huijian-helper .hint').innerText()).includes('language or region'),
  );
  await practice.keyboard.press('Escape');
  await rpc({ type: 'saveSettings', patch: { mode: 'hover' } });
  // Hover over the price text itself; a block element's box extends far beyond its text.
  const hovered = await practice.locator('#dbl').boundingBox();
  await practice.mouse.move(hovered.x + hovered.width * 0.6, hovered.y + hovered.height / 2, {
    steps: 4,
  });
  await practice.getByRole('button', { name: 'Convert to USD', exact: true }).waitFor();
  check('hover mode prompts when the pointer rests on a price');
  await practice.mouse.move(5, 5, { steps: 4 });
  await practice.waitForFunction(() => !document.querySelector('huijian-helper'), null, {
    timeout: 5000,
  });
  check('a hover prompt leaves with the pointer');
  await rpc({
    type: 'saveSettings',
    patch: { mode: 'prompt', blockedSites: [new URL(origin).host] },
  });
  const badges = () =>
    sw.evaluate(async () =>
      Promise.all(
        (await chrome.tabs.query({})).map((tab) => chrome.action.getBadgeText({ tabId: tab.id })),
      ),
    );
  for (let i = 0; i < 30 && !(await badges()).includes('OFF'); i++)
    await practice.waitForTimeout(100);
  check('the toolbar badge shows OFF on a paused site', (await badges()).includes('OFF'));
  await rpc({ type: 'saveSettings', patch: { blockedSites: [] } });
  await practice.goto(base + 'practice.html');
  await practice
    .getByRole('heading', { name: 'The world’s prices. Closer to home.', exact: true })
    .waitFor();
  await noHan(practice, 'built-in practice page translated');
  await settings.getByRole('button', { name: 'Preferences', exact: true }).click();
  await settings.getByLabel('Language', { exact: true }).selectOption('zh-CN');
  await practice.getByRole('heading', { name: '让世界的价格，更贴近你。', exact: true }).waitFor();
  check('built-in guide follows language changes');
  await page.goto(base + 'popup.html?popup=1');
  await page.getByLabel('兑换金额', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(out, 'chinese-converter.png'), animations: 'disabled' });
  check('Chinese interface remains available');
  check('no framework overlay', (await page.locator('vite-error-overlay').count()) === 0);
  check('no runtime errors', errors.length === 0);
  await fs.writeFile(
    path.join(out, 'i18n-checks.json'),
    JSON.stringify({ checks, errors, providerData: 'deterministic fixtures' }, null, 2),
  );
  console.log(`TOTAL ${checks.length} bilingual extension checks passed`);
} catch (error) {
  if (page) await page.screenshot({ path: path.join(out, 'i18n-failure.png') }).catch(() => {});
  throw error;
} finally {
  await context.close();
  server.close();
  await fs.rm(profile, { recursive: true, force: true });
}
