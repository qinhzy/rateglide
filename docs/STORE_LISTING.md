# 商店上架材料 · Store listing

本文汇总 Chrome Web Store 与 Microsoft Edge Add-ons 提交时需要填写的内容。各商店后台的字段和尺寸要求可能调整，提交时以后台当前提示为准。

## 上传包

运行 `pnpm build && pnpm package`，上传 `release/rateglide-store-<版本>.zip`。商店会分配自己的扩展 ID，因此这个包去掉了只用于固定开发者模式 ID 的 `key` 字段；其余内容与 `rateglide-chrome-edge-<版本>.zip` 相同。每次更新前在 `package.json` 提升版本号，清单版本会随之更新。

## 基本信息

| 字段         | 内容                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 名称         | 来自 `public/_locales`：English “RateGlide — Currency Converter & Card Rates”；简体中文“RateGlide · 汇见 — 划词汇率与全球比价” |
| 简短描述     | 来自 `_locales` 的 `extensionDescription`，两种语言均在 132 个字符以内                                                         |
| 默认语言     | English（`default_locale: en`），另有简体中文                                                                                  |
| 类别         | Chrome：购物（Shopping）或工具（Tools）；Edge：Shopping 或 Productivity                                                        |
| 隐私政策网址 | https://github.com/qinhzy/rateglide/blob/main/docs/PRIVACY.md                                                                  |
| 支持网址     | https://github.com/qinhzy/rateglide/issues                                                                                     |

## 详细描述 · English

> RateGlide puts currency conversion where prices are. Select a price on any webpage — or simply double-click the number — and see it in your home currency without leaving the page.
>
> • Reads real-world prices: $129.00, € 1.234,56, HK$ 2,680, 1,980円, ₩15,000, RM 25.90, Rp 150.000, $1.5 million, 2.5万日元 and many more. Symbols shared by several currencies follow the page: ¥ on a Chinese page is CNY, on a Japanese page JPY.
> • Prices already in your currency stay quiet. An optional hover mode prompts when your pointer rests on a price.
> • Compare transfer estimates from Wise, HSBC, PayPal, Remitly, Western Union and others, with each route’s total cost against the mid-market rate.
> • Get official Visa and Mastercard calculator rates with dates, bank fees and estimated bills, and Revolut’s public exchange quotes.
> • Keep a watchlist with daily changes, see an amount in several currencies at once, and switch between English and Simplified Chinese.
>
> Every rate is labeled with its source and time: live mid-market, daily reference, collected estimate or published card rate. No account, ads or analytics. Selected text is read on your device; only the fields a rate provider needs, such as currency codes and the amount you compare, are sent to that provider.

## 详细描述 · 简体中文

> 汇见把换算放在价格旁边。在任意网页选中一笔价格，或者直接双击数字，不离开页面就能看到目标货币金额。
>
> • 识别真实网页里的写法：$129.00、€ 1.234,56、HK$ 2,680、1,980円、₩15,000、RM 25.90、Rp 150.000、$1.5 million、2.5万日元 等。多国共用的符号按网页判断：中文网页的 ¥ 是人民币，日文网页的 ¥ 是日元。
> • 已是目标货币的价格保持安静；也可以开启悬停模式，鼠标停在价格上即出现提示。
> • 比较 Wise、汇丰、PayPal、Remitly、西联等平台的到账估算，并给出每家相对中间价的总成本。
> • 插件内查询 Visa、万事达官方计算器报价（含日期、发卡行附加费与预计账单）和 Revolut 公开换币报价。
> • 关注列表显示每日涨跌，一笔金额可同时折合多个币种，界面支持简体中文与 English。
>
> 每个汇率都标明来源与时间：实时中间价、每日参考、采集估算或卡组织公布价。无账户、无广告、无分析埋点。选中的文字只在本机识别，只把报价所需的字段（例如币种代码，以及比价时的金额）发送给对应的报价来源。

## 单一用途 · Single purpose

> Convert and compare currency amounts: RateGlide converts prices the user selects on webpages and shows exchange-rate quotes from fixed public sources.

## 权限说明 · Permission justification

| 权限                                          | 用途                                                                                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                     | Saves preferences, the watchlist, optional local history and short-lived rate caches in local browser storage.                                             |
| `contextMenus`                                | Adds “Convert with RateGlide” for selected text.                                                                                                           |
| `clipboardWrite`                              | Copies a conversion result when the user clicks Copy.                                                                                                      |
| `https://wise.com/*`                          | Live mid-market rates.                                                                                                                                     |
| `https://api.wise.com/*`                      | Transfer comparison estimates for the route and amount the user compares.                                                                                  |
| `https://open.er-api.com/*`                   | Daily reference rates (one fixed request for all currencies).                                                                                              |
| `https://api.frankfurter.dev/*`               | Central-bank daily reference rates when the user chooses that source.                                                                                      |
| `https://www.boc.cn/*`                        | Bank of China published CNY rates when the user chooses that source.                                                                                       |
| `https://www.visa.co.uk/*`                    | Visa’s official exchange-rate calculator for the Cards tab.                                                                                                |
| `https://www.mastercard.com/*`                | Mastercard’s official exchange-rate calculator for the Cards tab.                                                                                          |
| `https://www.revolut.com/*`                   | Revolut’s public exchange calculator.                                                                                                                      |
| Content script on `http://*/*`, `https://*/*` | Detects the currency amount the user selects, double-clicks or (optionally) hovers, and shows the conversion popup. Text is parsed locally and never sent. |

RateGlide does not request `tabs`, `scripting`, `activeTab`, history, cookies or downloads permissions.

## 远程代码 · Remote code

不使用远程代码。所有脚本随扩展打包；网络请求只获取 JSON 或 HTML 数据（中国银行牌价页按数据解析），不执行下载的代码。

## 数据使用披露 · Data usage

- 不收集账号、密码、支付或卡号信息，不出售或转让数据，不用于与汇率无关的用途，不用于信用评估。
- 网页文本只在本机读取，不传出设备。用户主动比价或查询刷卡报价时，会把金额、币种、地区、日期和所填费率发送给对应报价来源；普通换算只发送币种代码。按 Chrome 的定义，“收集”指数据传出设备，填写“网站内容”一项时建议如实说明这一点，并与 [隐私说明](PRIVACY.md) 保持一致。
- 历史记录默认关闭，开启后只保存在本机。

## 截图与图片素材

| 素材       | Chrome Web Store                | Edge Add-ons                   |
| ---------- | ------------------------------- | ------------------------------ |
| 图标       | 包内 `icons/128.png`            | 300 × 300 商店图标（另行导出） |
| 截图       | 1280 × 800 或 640 × 400，1–5 张 | 可选，同样尺寸                 |
| 小型宣传图 | 440 × 280                       | 可选                           |

建议素材：划词浮层（含多币种速览）、工具栏换算、比价总成本、刷卡账单对比、关注列表。`pnpm test:i18n` 会在 `RATEGLIDE_QA_DIR` 生成界面截图，可作为构图参考；其中的报价是测试夹具，正式素材请在联网环境中用真实报价截取。图标可由 `scripts/build.mjs` 中的 SVG 用 sharp 导出到任意尺寸。

## 提交步骤

1. **Chrome**：注册 Chrome Web Store 开发者账号（一次性注册费），新建项目并上传商店包，填写商品详情、隐私规范和分发范围后提交审核。
2. **Edge**：在 Microsoft Partner Center 注册 Edge 扩展开发者（免费），上传同一个商店包，填写商店信息后提交审核。
3. **Safari**：需要 Apple Developer Program、完整 Xcode 和签名；构建后运行 `zsh scripts/package-safari.sh` 生成 Xcode 项目，再通过 App Store Connect 提交。
4. 上架后，把 README 的安装说明改为商店链接，并保留开发者模式安装作为备选。
