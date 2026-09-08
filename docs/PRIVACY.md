# RateGlide privacy

RateGlide has no login, analytics, advertising, or transfer execution. It does not ask for bank credentials or card numbers.

Selected text is parsed locally. It never sends the full webpage, page title, browsing history, or selected sentence to a rate provider. Queries send only the fields a provider needs: currency codes and, depending on the feature, amounts, countries, transaction dates, and an optional bank fee. Providers also receive normal network metadata such as the connection IP address.

Requests use `credentials: omit` and `referrerPolicy: no-referrer`. Provider requests go directly to eight fixed domains: `wise.com`, `api.wise.com`, `open.er-api.com`, `api.frankfurter.dev`, `www.boc.cn`, `www.visa.co.uk`, `www.mastercard.com`, and `www.revolut.com`. Those providers operate under their own terms and privacy policies.

Preferences and rate caches stay in browser-local storage. History is off by default. When enabled, it records only conversions that you explicitly copy, up to 50 entries. It stores amounts, currencies, results, source labels, and timestamps, but no page addresses or selected text. You can export or clear history in Settings. Removing the extension removes its local storage under normal browser behavior.

The content script can run on ordinary HTTP and HTTPS webpages to detect currency selections. It skips inputs, password fields, and editable regions. You can pause selection conversion globally, exclude sites, or require Alt / Option. Browser permissions can further restrict website access.

All executable code is bundled with the extension. It does not download remote scripts. The development server has local proxies for previewing APIs; installed extensions do not depend on that server.

Questions or problems: use this repository’s issue tracker without including account credentials, personal bank statements, or card details.

## 中文

RateGlide · 汇见不提供账户登录、广告、分析埋点或转账功能，不读取银行凭据和卡号。选中文字在本机解析，只向报价来源发送必要的币种、金额、地区、日期或银行费率，不上传网页全文、标题、浏览历史或选中原文。数据提供方仍会收到正常网络连接信息，例如 IP 地址。

偏好设置与缓存保存在浏览器本地。历史默认关闭，开启后仅记录主动复制的最近 50 条换算，可导出或清空。划词脚本跳过输入框和可编辑区域，并支持暂停、网站排除和按住 Alt / Option 才触发。安装后的插件不依赖本地开发服务器。
