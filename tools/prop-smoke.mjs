import { chromium } from 'playwright-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push(e.message));

await page.goto('http://127.0.0.1:5173/?autosave=0', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

// 组件库面板在设计器初始化后会自动展开，仅在未展开时兜底点击 dock
const dockItems = page.locator('.lc-dock');
const paneOpen = await page
  .getByText('单行文本', { exact: true })
  .first()
  .isVisible()
  .catch(() => false);
if (!paneOpen) {
  await dockItems.nth(1).click();
  await page.waitForTimeout(1200);
}

// 拖入单行文本
const item = page.getByText('单行文本', { exact: true }).first();
const itemBox = await item.boundingBox();
const frameEl = page.locator('iframe.lc-simulator-content-frame').first();
const frameBox = await frameEl.boundingBox();
await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
await page.mouse.down();
await page.mouse.move(itemBox.x + 40, itemBox.y + 60, { steps: 5 });
await page.waitForTimeout(300);
await page.mouse.move(frameBox.x + frameBox.width / 2, frameBox.y + 200, { steps: 20 });
await page.waitForTimeout(500);
await page.mouse.up();
await page.waitForTimeout(2000);

// 选中画布中的 .ant-input
const frame = await (await frameEl.elementHandle()).contentFrame();
const selected = await page.evaluate(() => {
  const doc = window.AliLowCodeEngine.project.currentDocument;
  const child = doc.root.children.get(0);
  doc.selection.select(child.id);
  return { node: child.componentName, id: child.id };
});
console.log('selected', selected);
await page.waitForTimeout(1500);

const panel = await page.evaluate(() => {
  const right = document.querySelector('.lc-right-area');
  const inputs = [...(right?.querySelectorAll('input, textarea') ?? [])].map((el) => ({
    tag: el.tagName,
    type: el.type,
    value: el.value,
    placeholder: el.placeholder,
    cls: el.className,
  }));
  return { text: (right?.innerText ?? '').slice(0, 1200), inputs };
});

// 修改「标题」属性
const panel2 = await page.evaluate(() => {
  const right = document.querySelector('.lc-right-area');
  return {
    text: (right?.innerText ?? '').slice(0, 800),
    inputs: [...(right?.querySelectorAll('input') ?? [])].map((el) => ({ type: el.type, value: el.value, ph: el.placeholder })),
  };
});
const result = await page.evaluate(() => {
  const inputs = document.querySelectorAll('.lc-right-area input');
  const el = inputs[1];
  if (!el) return { error: 'title input not found', count: inputs.length };
  const rect = el.getBoundingClientRect();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, '姓名');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }, value: el.value };
});
console.log('edit result', result);
await page.waitForTimeout(1800);
const after = await frame.evaluate(() => ({
  label: document.querySelector('.ant-input')?.querySelector('label')?.textContent?.trim(),
  html: document.querySelector('#app')?.innerHTML ?? '',
}));
console.log(JSON.stringify({ panel: panel.text, after, logs: logs.slice(0, 6) }, null, 2));
await page.screenshot({ path: '/tmp/lc-prop.png' });
await page.screenshot({ path: '/tmp/lc-prop.png' });
await Promise.race([browser.close().catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 5000))]);
