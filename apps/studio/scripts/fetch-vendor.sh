#!/usr/bin/env bash
# 下载低代码引擎运行所需的 UMD 资源到 public/vendor。
# 支持 HTTPS_PROXY / https_proxy 环境变量。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${SCRIPT_DIR}/../public/vendor"

mkdir -p "${DEST}/theme"

fetch() {
  local url="$1"
  local out="$2"
  echo "  → ${out}"
  curl -fsSL --retry 3 --retry-delay 1 --max-time 120 "${url}" -o "${DEST}/${out}"
}

echo "Downloading lowcode-engine vendor assets to ${DEST}"

# React 18（引擎在 legacy ReactDOM.render 模式下运行，已验证可用）
fetch "https://unpkg.com/react@18.3.1/umd/react.development.js" "react.development.js"
fetch "https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" "react-dom.development.js"

# Ant Design 6（物料设计系统 UMD，供模拟器 iframe 使用）
fetch "https://unpkg.com/antd@6.6.7/dist/antd.min.js" "antd.min.js"
fetch "https://unpkg.com/antd@6.6.7/dist/reset.css" "antd.reset.css"
fetch "https://unpkg.com/dayjs@1.11.13/dayjs.min.js" "dayjs.min.js"

# 引擎运行时依赖
fetch "https://unpkg.com/prop-types@15.7.2/prop-types.js" "prop-types.js"
fetch "https://g.alicdn.com/platform/c/react15-polyfill/0.0.1/dist/index.js" "react15-polyfill.js"
fetch "https://g.alicdn.com/platform/c/lodash/4.6.1/lodash.min.js" "lodash.min.js"
fetch "https://g.alicdn.com/mylib/moment/2.24.0/min/moment.min.js" "moment.min.js"
fetch "https://g.alicdn.com/code/lib/alifd__next/1.24.18/next.min.js" "next.min.js"
fetch "https://g.alicdn.com/code/lib/alifd__next/1.24.18/next.min.css" "next.min.css"

# 低代码引擎 UMD 与样式
fetch "https://unpkg.com/@alilc/lowcode-engine@1.3.4/dist/js/engine-core.js" "engine-core.js"
fetch "https://unpkg.com/@alilc/lowcode-engine@1.3.4/dist/css/engine-core.css" "engine-core.css"
fetch "https://unpkg.com/@alilc/lowcode-engine-ext@1.0.6/dist/js/engine-ext.js" "engine-ext.js"
fetch "https://unpkg.com/@alilc/lowcode-engine-ext@1.0.6/dist/css/engine-ext.css" "engine-ext.css"

# 模拟器（引擎默认会从 simulatorUrl 目录查找这两个文件）
fetch "https://unpkg.com/@alilc/lowcode-engine@1.3.4/dist/js/react-simulator-renderer.js" "react-simulator-renderer.js"
fetch "https://unpkg.com/@alilc/lowcode-engine@1.3.4/dist/css/react-simulator-renderer.css" "react-simulator-renderer.css"

# Fusion Next 主题
fetch "https://alifd.alicdn.com/npm/@alifd/theme-lowcode-light@0.2.1/variables.css" "theme/variables.css"
fetch "https://alifd.alicdn.com/npm/@alifd/theme-lowcode-light@0.2.1/dist/next.var.min.css" "theme/next.var.min.css"

echo "Done."
