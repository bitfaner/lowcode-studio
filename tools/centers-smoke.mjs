import { chromium } from 'playwright-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const STUDIO = process.env.STUDIO_URL ?? 'http://127.0.0.1:5173';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  await page.goto(`${STUDIO}/?center=components&pageId=page_home&autosave=0`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(800);

  const componentReport = await page.evaluate(() => {
    const app = document.querySelector('#app');
    const center = app?.querySelector('.lc-center');
    return {
      nav: [...(app?.querySelectorAll('.ant-menu-item') ?? [])].map((button) =>
        button.textContent?.replace(/\s+/g, ' ').trim(),
      ),
      cards: center?.querySelectorAll('[data-component-preview]').length ?? 0,
      previews: center?.querySelectorAll('[data-component-preview] > *').length ?? 0,
    };
  });
  assert(componentReport.nav.length === 3, '顶部导航未渲染');
  assert(componentReport.nav[0]?.includes('组件中心'), '缺少组件中心入口');
  assert(componentReport.nav[1]?.includes('设计中心'), '缺少设计中心入口');
  assert(componentReport.nav[2]?.includes('产物中心'), '缺少产物中心入口');
  assert(componentReport.cards > 0, '组件目录为空');
  assert(
    componentReport.previews === componentReport.cards,
    `组件实时预览不完整：${componentReport.previews}/${componentReport.cards}`,
  );
  console.log('组件中心:', JSON.stringify(componentReport));

  await page.evaluate(() => {
    const app = document.querySelector('#app');
    const button = [...app.querySelectorAll('.ant-menu-item')].find((item) =>
      item.textContent?.includes('产物中心'),
    );
    button?.click();
  });
  await page.waitForTimeout(700);

  const artifactReport = await page.evaluate(() => {
    const app = document.querySelector('#app');
    const center = app?.querySelector('.lc-artifact-center');
    return {
      active: [...(app?.querySelectorAll('.ant-menu-item') ?? [])]
        .find((button) => button.classList.contains('ant-menu-item-selected'))
        ?.textContent?.replace(/\s+/g, ' ').trim(),
      rows: center?.querySelectorAll('.artifact-table .ant-table-tbody tr.ant-table-row').length ?? 0,
      actions: [...(center?.querySelectorAll('.ant-table-tbody .ant-btn') ?? [])].map((button) =>
        button.textContent?.trim(),
      ),
      error: center?.querySelector('.notice.error')?.textContent?.trim() ?? null,
    };
  });
  assert(artifactReport.active?.includes('产物中心'), '未切换到产物中心');
  assert(artifactReport.rows > 0, '产物列表为空');
  assert(!artifactReport.error, `产物加载失败：${artifactReport.error}`);
  for (const action of ['设计', '预览', '渲染', '发布']) {
    assert(artifactReport.actions.includes(action), `产物操作缺少“${action}”`);
  }
  console.log('产物中心:', JSON.stringify({
    active: artifactReport.active,
    rows: artifactReport.rows,
    actions: [...new Set(artifactReport.actions)],
  }));

  await page.evaluate(() => {
    const app = document.querySelector('#app');
    const button = [...app.querySelectorAll('.ant-menu-item')].find((item) =>
      item.textContent?.includes('设计中心'),
    );
    button?.click();
  });
  await page.waitForTimeout(4000);

  const designReport = await page.evaluate(() => ({
    designer: Boolean(document.querySelector('#lce-designer')),
    iframes: document.querySelectorAll('iframe').length,
  }));
  assert(designReport.designer, '设计中心未挂载');
  assert(designReport.iframes > 0, '设计器画布未创建');
  console.log('设计中心:', JSON.stringify(designReport));

  const selectedButtonGroup = await page.evaluate(() => {
    const tab = [...document.querySelectorAll('div')].find((element) => {
      if (element.textContent?.trim() !== '展示') return false;
      const rect = element.getBoundingClientRect();
      return getComputedStyle(element).cursor === 'pointer' && rect.height === 32;
    });
    tab?.click();
    return Boolean(tab);
  });
  assert(selectedButtonGroup, '组件库缺少“展示”分组');
  await page.waitForTimeout(400);

  const buttonEntry = await page.evaluate(() => {
    const button = document.querySelector('[data-id$="_LcButton_按钮"]');
    const panelBody = button?.closest('.lc-panel-body');
    if (!button || !panelBody) return { available: false, visible: false };
    const buttonRect = button.getBoundingClientRect();
    const panelRect = panelBody.getBoundingClientRect();
    return {
      available: true,
      icon: button.querySelector('img')?.getAttribute('src') ?? null,
      visible:
        buttonRect.width > 0 &&
        buttonRect.height > 0 &&
        buttonRect.left >= panelRect.left &&
        buttonRect.right <= panelRect.right &&
        buttonRect.top >= panelRect.top &&
        buttonRect.bottom <= panelRect.bottom,
    };
  });
  assert(buttonEntry.available, '组件库缺少按钮入口');
  assert(buttonEntry.icon?.includes('/assets/icons/button.svg'), '按钮入口缺少专属图标');
  assert(buttonEntry.visible, '按钮入口被组件库分组布局遮挡');
  console.log('按钮入口:', JSON.stringify(buttonEntry));
  assert(pageErrors.length === 0, `页面异常：${pageErrors.join('; ')}`);

  await page.screenshot({ path: '/tmp/lc-centers-smoke.png' });
} finally {
  await Promise.race([browser.close().catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 5000))]);
}
