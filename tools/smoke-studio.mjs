import { chromium } from 'playwright-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = process.env.STUDIO_URL ?? 'http://127.0.0.1:5173/';
// 冒烟脚本只读画布，关闭自动保存避免任何意外写入
const URL = `${BASE_URL}${BASE_URL.includes('?') ? '&' : '?'}autosave=0`;

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const logs = [];
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    logs.push(`[${message.type()}] ${message.text()}`);
  }
});
page.on('pageerror', (error) => logs.push(`[pageerror] ${error.stack ?? error.message}`));
const failed = [];
page.on('response', (response) => {
  if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
});
page.on('requestfailed', (request) => {
  failed.push(`FAILED ${request.url()} ${request.failure()?.errorText ?? ''}`);
});

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForTimeout(8_000);

const state = await page.evaluate(() => ({
  engine: Boolean(window.AliLowCodeEngine),
  engineExt: Boolean(window.___AliLowCodeEngineExt___),
  designerHtmlLength: document.querySelector('#lce-designer')?.innerHTML.length ?? 0,
  designerHtml: (document.querySelector('#lce-designer')?.innerHTML ?? '').slice(0, 1500),
  iframes: [...document.querySelectorAll('iframe')].map((frame) => ({
    src: frame.src,
    srcdocLength: frame.srcdoc?.length ?? 0,
    display: getComputedStyle(frame).display,
  })),
  bodyText: (document.body.innerText ?? '').slice(0, 600),
}));

const frameReports = [];
for (const frame of page.frames()) {
  if (frame === page.mainFrame()) continue;
  try {
    const report = await frame.evaluate(() => ({
      url: location.href,
      readyState: document.readyState,
      lcPage: Boolean(document.querySelector('.lc-page')),
      lcInput: Boolean(document.querySelector('.ant-input')),
      bodyHtml: (document.body?.innerHTML ?? '').slice(0, 1200),
      scripts: [...document.querySelectorAll('script')].map((script) => script.src).slice(0, 20),
      rootText: (document.body.innerText ?? '').slice(0, 200),
    }));
    frameReports.push(report);
  } catch (error) {
    frameReports.push({ url: frame.url(), error: String(error) });
  }
}

let download = null;
try {
  const [downloadEvent] = await Promise.all([
    page.waitForEvent('download', { timeout: 5_000 }),
    page.getByRole('button', { name: '导出 Schema' }).click(),
  ]);
  download = downloadEvent.suggestedFilename();
} catch (error) {
  download = `失败：${error.message}`;
}

await page.screenshot({ path: '/tmp/lc-studio.png', fullPage: false });

console.log(JSON.stringify({ state, frameReports, download, failed, logs }, null, 2));

await Promise.race([browser.close().catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 5000))]);
