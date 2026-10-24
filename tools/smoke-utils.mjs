import { chromium } from 'playwright-core';

/**
 * 冒烟脚本的公共启动与断言工具。
 *
 * 约定：脚本失败时抛出异常（process 退出码非 0），e2e.mjs 据此判定通过与否；
 * 只打印日志而不校验的写法已经不再使用。
 */
export const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** 引擎 / antd 的历史告警不影响功能，不视为失败 */
const IGNORED_ERROR = [/^Warning:/, /\[vite\]/, /ReactDOM\.render is no longer supported/];

export async function launch(options = {}) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  // Chrome 偶发卡在关闭流程上，加个上限，避免脚本在 finally 里挂十几分钟
  const closeBrowser = browser.close.bind(browser);
  browser.close = async () => {
    await Promise.race([
      closeBrowser().catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
  };
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, ...options });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (IGNORED_ERROR.some((pattern) => pattern.test(text))) return;
    errors.push(text);
  });
  return { browser, page, errors };
}

/** antd 会在两个中文字符之间插入空格（「保 存」），按字符匹配按钮文案 */
export function textPattern(label) {
  const chars = [...label].map((char) => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(chars.join('\\s*'));
}

export function button(root, label) {
  return root.locator('button').filter({ hasText: textPattern(label) }).first();
}

export function check(condition, message) {
  if (!condition) throw new Error(message);
}

export function checkEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}：期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
  }
}

export function report(errors, allowed = []) {
  const remaining = errors.filter((text) => !allowed.some((pattern) => pattern.test(text)));
  if (remaining.length > 0) {
    throw new Error(`控制台出现未预期的错误：\n${remaining.slice(0, 5).join('\n')}`);
  }
}

/** 抽屉（antd Drawer）当前内容 */
export async function drawerState(page) {
  return page.evaluate(() => {
    const wrapper = document.querySelector('.ant-drawer-content-wrapper');
    const visible = wrapper
      ? getComputedStyle(wrapper).display !== 'none' && wrapper.getBoundingClientRect().width > 0
      : false;
    const body = document.querySelector('.ant-drawer-body');
    return {
      visible,
      title: document.querySelector('.ant-drawer-title')?.textContent?.trim() ?? null,
      inputs: [...(body?.querySelectorAll('input') ?? [])].map((input) => ({
        name: input.getAttribute('name'),
        value: input.value,
      })),
    };
  });
}

/** 轮询等待某处文案出现（状态文案通常在请求完成后异步渲染，避免直接读取产生竞态） */
export async function waitForText(locator, text, timeout = 10000) {
  const deadline = Date.now() + timeout;
  let last = '';
  while (Date.now() < deadline) {
    last = (await locator.innerText()).replace(/\s+/g, ' ');
    if (last.includes(text)) return last;
    await locator.page().waitForTimeout(300);
  }
  throw new Error(`等待文案「${text}」超时，当前内容：${last}`);
}
