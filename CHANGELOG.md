# Changelog

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
