# RateGlide · 汇见

**Currency at your cursor.** Select a price, see it in your currency, and compare where your money goes.

English · [简体中文](README.zh-CN.md)

RateGlide is a browser extension with **English and Simplified Chinese** interfaces. It brings currency conversion, transfer comparisons, and official Visa / Mastercard card rates into one compact toolbar and webpage selection popup.

## What you can do

- Select `$129.00`, `€ 1.234,56`, `HK$ 2,680`, or `2.5万日元` on a webpage and convert it without leaving the page. Prices already in your home currency stay quiet, and the popup follows the selection as you scroll.
- Search currencies by code, name, country, or everyday Chinese names such as 加元 and 美金, with the keyboard or the mouse. Amounts accept `2.5k` or `1.2万`, and pasting a price such as `€ 1.234,56` fills in its currency too.
- Swap directions, see both rate directions, copy results, and keep a watchlist. The toolbar remembers your last conversion.
- Query **Visa and Mastercard official calculators** inside the extension, with actual rate dates, optional issuer fees, historical queries, estimated bills, and which card is estimated to cost less.
- View **Revolut public exchange quotes** by account region, including plan fees.
- Compare available **Wise, HSBC, PayPal, Remitly, Western Union, OFX, and other provider estimates**, with fees, received amounts, regions, and collection times. The route with the most received is marked, along with how much less each alternative delivers.
- Switch language from the toolbar or Preferences. It follows the browser by default and synchronizes across open extension pages and selection popups.
- Choose light, dark, or system appearance; prompt before conversion, convert immediately, or require Alt / Option; exclude sites or pause the current one from the toolbar, and optionally keep local history.

Rate queries stay inside the extension. A source-attribution link is optional; you never need to visit a provider website just to see an available quote.

## Install

Download a package from [Releases](https://github.com/qinhzy/rateglide/releases), or build from source below.

### Chrome and Edge

1. Unzip `rateglide-chrome-edge-<version>.zip` into a folder you will keep.
2. Open `chrome://extensions` or `edge://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the folder containing `manifest.json`.
4. Pin RateGlide to the toolbar and refresh any previously open webpages.

For a source build, load `release/chromium`. After updating, reload the extension from its management page and refresh existing webpages. Developer-mode installations do not update automatically. Do not delete the loaded folder.

### Safari on macOS

The Safari archive contains **Web Extension resources**, not a signed macOS app. Recent Safari versions can load the unzipped `safari-web-extension` resources using **Developer → Add Temporary Extension**. Enable web developer features first if needed and complete the system authorization prompt. Temporary extensions expire after quitting Safari or after 24 hours.

For a permanent app, install full Xcode and run `zsh scripts/package-safari.sh` after building. The generated project still needs your Apple signing and distribution setup. A signed Safari app and App Store release are not included. See [Apple’s Safari extension instructions](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension).

## Your first conversion

1. Choose your home currency in **Settings → Preferences**. New English installations start with USD; Chinese installations start with CNY. Existing preferences are preserved.
2. Select a complete price on a regular webpage and click **Convert to …**. Change either currency if a symbol was ambiguous. Prices already in your home currency do not prompt; the context menu and shortcut convert them into your first watched currency instead.
3. Open **Compare** for transfer estimates or **Cards** for Visa / Mastercard rates, dates, and issuer fees.
4. Use **Settings → Guide → Open the practice page** to try selection without a local development server.

`$` defaults to USD and `¥` to JPY, with an editable assumption notice. The parser supports ISO codes, common symbols, Chinese currency names, decimal conventions, Indian digit grouping, Arabic digits, and k/m or Chinese multipliers. Plain-number recognition is off by default. Inputs, editable areas, ordinary text, dates, ranges, and multiple prices do not trigger automatic conversion.

The shortcut is **Alt / Option + Shift + C**; Preferences and the guide show the shortcut your browser actually assigned and link to its shortcut settings. You can also right-click selected text. Browser settings pages, extension stores, other extension pages, and built-in PDF viewers restrict content scripts; use the toolbar converter there.

## Know what each rate means

| Source                | Data and coverage                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wise                  | Online mid-market rate; 60-second cache. Excludes transfer fees.                                                                                                                       |
| ExchangeRate-API Open | Daily reference rates; 166 currencies at the latest live verification. Checked hourly. Coverage can change.                                                                            |
| Frankfurter           | Daily central-bank and official reference data. Not a bank customer quote.                                                                                                             |
| Bank of China         | Published CNY buying / selling rates for foreign-currency transfers, normalized from rates per 100 units. No invented cross-currency bank rates.                                       |
| Wise comparisons      | Collected and estimated bank / transfer-provider quotes by route, amount, and region. HSBC and PayPal availability depends on the route. Not personal account pricing.                 |
| Revolut               | Official public exchange calculator, account region, and plan costs. Currency minor units respect zero-, two-, and three-decimal currencies.                                           |
| Visa / Mastercard     | Official calculator rates and actual publication dates. Optional issuer fee is included exactly once. Historical requests support the last 365 days, subject to provider availability. |

**Broad currency coverage does not mean every bank publishes every customer’s transaction rate.** Account offers, funding methods, transfer routes, card processing dates, and issuer policies can change the final amount. Daily references, collected estimates, card rates, and live mid-market rates are labeled separately.

Automatic conversion tries Wise, then explicitly labels a daily-reference fallback. Manually selected providers never silently switch to another provider. Offline cached quotes are labeled; missing Visa / Mastercard quotes are never replaced with market rates. Card cache keys include network, currencies, amount, date, and issuer fee.

Sources: [Wise comparison API](https://docs.wise.com/api-reference/comparison), [ExchangeRate-API Open](https://www.exchangerate-api.com/docs/free), [Frankfurter](https://frankfurter.dev/), [Bank of China](https://www.boc.cn/sourcedb/whpj/), [Visa calculator](https://www.visa.co.uk/support/consumer/travel-support/exchange-rate-calculator.html), [Mastercard calculator](https://www.mastercard.com/global/en/personal/get-support/currency-exchange-rate-converter.html), and [Revolut converter](https://www.revolut.com/currency-converter/). Public website endpoints can change or rate-limit clients; errors are shown explicitly.

## Privacy

No login, ads, analytics, bank credentials, card numbers, or money transfers. Text recognition runs locally. Only the query fields needed by a provider are sent to its fixed domain. Preferences and caches stay in local browser storage. History is off by default and, when enabled, keeps only the latest 50 copied conversions.

See [the privacy document](docs/PRIVACY.md) for permissions, provider domains, transmitted fields, and storage behavior.

## Develop and test

Use Node.js 22.13+ and the pnpm version in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm exec playwright install chromium webkit
pnpm test:i18n
pnpm package
```

`pnpm package` uses the `zip` and `unzip` command-line tools, available on macOS and typical Linux environments. It creates flat, loadable Chrome / Edge and Safari archives in `release/`.

For interactive preview and live integration checks:

```sh
pnpm dev
# Keep the server on http://127.0.0.1:4173 running in another terminal:
pnpm test:browser
pnpm test:webkit
pnpm test:payments
```

Unit tests and `test:i18n` are deterministic. Bilingual browser tests use explicitly mocked provider responses and a separate temporary Chromium profile. They cover language detection and persistence, cross-page updates, keyboard currency search, amount shorthands, remembered conversions, card fees, cheaper-card and best-route markers, stale states, bank filters, history export, real mouse selection including home-currency prices, and responsive layouts.

Live integration tests use real public providers and may fail when providers change or deny requests. Card integration checks use an ordinary visible Chromium browser because official calculators may reject headless clients. Tests never import a personal browser profile or cookies. GitHub Actions runs unit tests, builds both packages, and runs deterministic bilingual extension tests.

The Chromium public key in `design/extension-public-key.txt` only keeps the unpacked extension ID stable. It is not a secret; no private key is stored. Existing `huijian:` storage keys and selection host IDs are intentionally retained for compatibility.

## Browser status

- **Chrome / Chromium:** extension background, toolbar UI, selection, bilingual behavior, and provider flows are covered by tests. The earlier 1.1 build also received native Chrome smoke testing.
- **Safari:** WebKit renderer checks and native 1.1 temporary-extension selection / card-page smoke testing. Permanent signing and distribution remain external setup steps.
- **Edge:** Chromium-compatible package generated; not yet tested in a native Edge installation.

This is a working developer-mode release, not a Chrome Web Store, Edge Add-ons, or Safari App Store publication. Test results describe exercised cases; they are not a guarantee of zero bugs or universal provider availability.

## Contribute

Report the browser version, extension version, language, currency route, and steps to reproduce. Avoid sharing account credentials or personal financial information. Add translations in `src/i18n/messages.ts` and manifest strings in `public/_locales/`. Run unit and bilingual tests before submitting changes.

Provider names and logos belong to their owners. RateGlide is independent and is not affiliated with the listed financial institutions. Code is available under the [MIT License](LICENSE).
