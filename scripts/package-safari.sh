#!/bin/zsh
set -eu
PROJECT_DIR="${0:A:h:h}"
cd "$PROJECT_DIR"
if xcrun --find safari-web-extension-packager >/dev/null 2>&1; then
  xcrun safari-web-extension-packager "$PROJECT_DIR/release/safari-web-extension" --project-location "$PROJECT_DIR/release/safari-xcode" --app-name 'RateGlide' --bundle-identifier 'app.rateglide.safari' --macos-only --swift --copy-resources --no-open --no-prompt
elif xcrun --find safari-web-extension-converter >/dev/null 2>&1; then
  xcrun safari-web-extension-converter "$PROJECT_DIR/release/safari-web-extension" --project-location "$PROJECT_DIR/release/safari-xcode" --app-name 'RateGlide' --bundle-identifier 'app.rateglide.safari' --macos-only --swift --copy-resources --no-open --no-prompt
else
  print '未安装完整 Xcode。当前 Safari 支持时，可在 设置 → 开发者 → 添加临时扩展 中选择：'
  print "$PROJECT_DIR/release/safari-web-extension"
  print '临时扩展会在退出 Safari 或 24 小时后移除；长期分发需使用 Xcode 和 Apple 开发者签名。'
  exit 2
fi
