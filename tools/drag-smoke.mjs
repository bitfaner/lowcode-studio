import { chromium } from 'playwright-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = process.env.STUDIO_URL ?? 'http://127.0.0.1:5173/';
// 冒烟脚本会直接改动画布，关闭自动保存避免污染草稿
const URL = `${BASE_URL}${BASE_URL.includes('?') ? '&' : '?'}autosave=0`;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();

const logs = [];
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    logs.push(`[${message.type()}] ${message.text()}`);
  }
});
page.on('pageerror', (error) => logs.push(`[pageerror] ${error.stack ?? error.message}`));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForTimeout(6000);

// 确保组件面板展开（左侧 dock 的第二个按钮）
const dockItems = page.locator('.lc-dock');
const dockCount = await dockItems.count();
if (dockCount > 1 && !(await page.getByText('单行文本', { exact: true }).first().isVisible().catch(() => false))) {
  await dockItems.nth(1).click();
  await page.waitForTimeout(1500);
}

const item = page.getByText('单行文本', { exact: true }).first();
await item.waitFor({ state: 'visible', timeout: 15000 });
const itemBox = await item.boundingBox();

// 找到模拟器 iframe（由引擎用 srcdoc 创建，url 为 about:blank）
const frameEl = page.locator('iframe.lc-simulator-content-frame').first();
await frameEl.waitFor({ state: 'attached', timeout: 20000 });
const frame = await (await frameEl.elementHandle()).contentFrame();
const frameBox = await frameEl.boundingBox();

// 模拟引擎 dragon 的拖拽
await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
await page.mouse.down();
await page.mouse.move(itemBox.x + 40, itemBox.y + 60, { steps: 5 });
await page.waitForTimeout(300);
await page.mouse.move(frameBox.x + frameBox.width / 2, frameBox.y + 200, { steps: 20 });
await page.waitForTimeout(800);
await page.mouse.up();
await page.waitForTimeout(2500);

const inFrame = await frame.evaluate(() => ({
  html: document.querySelector('#app')?.innerHTML ?? document.body.innerHTML.slice(0, 2000),
  hasLcInput: Boolean(document.querySelector('.ant-input')),
  hasSlInput: Boolean(document.querySelector('.ant-input')?.querySelector('.ant-input')),
  lcInputOuter: document.querySelector('.ant-input')?.outerHTML ?? null,
  lcInputShadow: document.querySelector('.ant-input')?.innerHTML?.slice(0, 1200) ?? null,
}));

const schema = await page.evaluate(() => {
  const host = window.LCSimulatorHost;
  const doc = host?.currentDocument;
  const page = doc?.exportSchema?.();
  return page ? JSON.stringify(page).slice(0, 4000) : 'no schema';
});

await page.screenshot({ path: '/tmp/lc-drag.png' });

console.log(JSON.stringify({ inFrame, schema, logs }, null, 2));
await Promise.race([browser.close().catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 5000))]);
