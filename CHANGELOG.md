# Changelog

## Unreleased

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
