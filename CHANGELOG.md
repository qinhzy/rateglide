# Changelog

## 1.3.0 — 2026-10-07

- Double-clicking a number picks up the currency written beside it, such as the $ of $129.00, so the most natural selection gesture now converts.
- Superscript cents such as $129<sup>99</sup> are read as $129.99 instead of an amount 100 times larger.
- $, ¥, 元, kr and Rs follow the page’s language, domain and nearby text: ¥ on a Chinese page is CNY and stays quiet for CNY users, ¥ on a Japanese page is JPY, and $ on a Canadian site is CAD. The popup names the reason, and Preferences can turn this off.
- Recognize local notations including 円, 원, RM, Rp, zł, Kč, Ft, lei, S/, Fr., руб. and đ; million, billion, Mrd, 百万, 千万, lakh, crore, juta, rb, 만 and 억; notes such as （税込） or (incl. VAT); and 1.299,- €.
- Read “150.000” as thousands for whole-unit currencies such as IDR and VND, and lone separators such as “1.299 €” by the page’s number format.
- Optional hover mode: resting the pointer on a price shows the conversion prompt.
- The selection popup shows both rate directions and the amount in up to three watched currencies; its currency menus show the code and name without clipping.
- The toolbar converter shows the saved quote immediately while it refreshes. When Wise is slow, automatic mode shows the daily reference meanwhile and switches to Wise once it answers.
- Comparisons show each route’s total cost against the mid-market rate, and card quotes show how far each network’s bill is from it.
- The watchlist shows changes since the previous daily reference, quotes small currencies per 100 or 1,000 units, names its source up front, places Add at the top, and offers Undo after removing a currency.
- Popup currency menus open as a titled sheet; the selection footer is one line and steps aside on Compare and Cards; typed values no longer look like placeholders; popup text is at least 11 px and settings descriptions 12 px.
- Settings confirm saves and report errors in a toast at the bottom of the window, wherever the change was made.
- A new installation opens the practice page. The toolbar badge shows OFF while selection is paused everywhere or on the current site.
- The script injected into webpages loads only the translations it shows: 68 KB → 43 KB, despite the new features.
- CI checks formatting.
- Currency search ranks exact and partial codes first and also matches country or region names and everyday Chinese names (加元, 美金, 台币). The current, home and watched currencies are listed first, and the list works with Arrow keys and Enter.
- Amount fields accept `2.5k`, `1bn`, `1.2万` and similar shorthands; pasting a price such as `€ 1.234,56` fills in the amount and currency.
- The toolbar popup focuses the amount on open, remembers the last conversion, follows home-currency changes, shows the inverse rate, and resets each tab to its top. Its tabs use tablist semantics with Arrow, Home and End keys.
- Comparisons list transfer estimates first, mark the route with the most received and show how much less other routes deliver. Card rates say which network is estimated to cost less.
- Selection conversion stays quiet for prices already in the home currency; the context menu and shortcut convert those into the first watched currency. The popup follows the selection while the page scrolls, waits for saved preferences, and its currency menus support type-ahead with a frequent group.
- Pause or resume selection conversion for the current site from the toolbar popup.
- Settings show the browser's actual shortcut with a link to change it, validate section links, read the version from the package, ask before clearing history, and can enable history in place.
- When automatic mode cannot reach Wise and the daily fallback lacks the currency, the error names Wise first.
- Raise the smallest text sizes, improve Visa contrast in dark mode, and remove unused styles.

## 1.2.0 — 2026-09-08

- Introduce **RateGlide · 汇见** and the English tagline **Currency at your cursor**.
- Add English and Simplified Chinese interfaces, browser-language detection, and a manual switch in the toolbar and preferences.
- Localize selection popups, provider metadata, cached error messages, currency search, context menus, guide, history, and CSV exports.
- Keep existing settings and saved quotes compatible; use USD as the first-run home currency for English browsers and CNY for Chinese browsers.
- Localize extension manifests for Chrome, Edge, and Safari and keep the existing Chromium extension ID.
- Add bilingual documentation, deterministic extension tests, and GitHub Actions checks.
- Guard malformed webpage keyboard events in the selection helper.

## 1.1.0 — 2026-09-08

- Query Visa and Mastercard official calculator rates inside the extension, including dates and issuer fees.
- Add Revolut public exchange quotes and plan costs by account region.
- Show available HSBC, PayPal, and other Wise-collected estimates inside the provider directory.
- Preserve actual rate dates, keep card fees from being applied twice, and clearly identify stale cached quotes.

## 1.0.0 — 2026-09-08

- Currency selection conversion, Wise live mid-market rates, global daily references, central-bank references, and Bank of China transfer rates.
- Transfer comparisons, watchlist, optional local history, site exclusions, and light/dark themes.
