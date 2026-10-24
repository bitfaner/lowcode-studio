import { check, checkEqual, launch, report } from './smoke-utils.mjs';

/**
 * 未保存修改冒烟：编辑画布后切换页面，必须弹出确认；取消后应留在当前页面。
 * 若应用下只有一个页面，脚本会临时创建一个并最终删除。
 * 需要先启动 pnpm dev:server / dev:studio。
 */
const STUDIO = process.env.STUDIO_URL ?? 'http://127.0.0.1:5173';
const API = process.env.API_URL ?? 'http://127.0.0.1:3000';

async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(process.env.STUDIO_TOKEN ? { authorization: `Bearer ${process.env.STUDIO_TOKEN}` } : {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${path} -> ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

const app = (await api('/api/apps/app_demo/pages')).app;
let pages = (await api('/api/apps/app_demo/pages')).pages ?? [];
if (pages.length === 0) throw new Error('应用下没有页面，请先运行 node tools/seed-demo.mjs');

let temporaryPageId = null;
if (pages.length < 2) {
  const created = await api(`/api/apps/${app.id}/pages`, {
    method: 'POST',
    body: JSON.stringify({ name: '脏检查临时页', slug: `dirty-${Date.now().toString(36)}`, type: 'form' }),
  });
  temporaryPageId = created.page.id;
  pages = (await api(`/api/apps/${app.id}/pages`)).pages ?? [];
}
check(pages.length >= 2, '页面数量不足，无法验证切换确认');

const currentPage = pages[0];
const otherPage = pages.find((item) => item.id !== currentPage.id);
const { browser, page, errors } = await launch();

let confirmMessage = null;
page.on('dialog', async (dialog) => {
  confirmMessage = dialog.message();
  await dialog.dismiss();
});

try {
  await page.goto(`${STUDIO}/?pageId=${currentPage.id}&autosave=0`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  const header = page.locator('.lc-studio-header');
  await header.waitFor({ timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.waitForFunction(() => Boolean(window.AliLowCodeEngine?.project?.currentDocument), null, {
    timeout: 60000,
  });

  // 制造一处修改：引擎会在 prop 变更时把设计器标记为 dirty
  await page.evaluate(() => {
    const doc = window.AliLowCodeEngine.project.currentDocument;
    doc.root.setPropValue('title', `dirty-${Date.now()}`);
  });
  await page.waitForTimeout(800);

  // 通过顶栏页面切换器切到另一个页面
  const selector = header.locator('.ant-select').first();
  await selector.waitFor({ timeout: 10000 });
  await selector.click();
  const option = page
    .locator('.ant-select-dropdown:visible .ant-select-item-option')
    .filter({ hasText: otherPage.name })
    .first();
  await option.waitFor({ timeout: 10000 });
  await option.click();
  await page.waitForTimeout(1200);

  check(confirmMessage !== null, '有未保存修改时切换页面应弹出确认');
  check(confirmMessage.includes('未保存'), `确认文案未提示未保存：${confirmMessage}`);

  const url = new URL(page.url());
  checkEqual(url.searchParams.get('pageId'), currentPage.id, '取消切换后应留在当前页面');
  const headerText = (await header.innerText()).replace(/\s+/g, ' ');
  check(headerText.includes(currentPage.name), `顶栏页面名未保持：${headerText}`);
  console.log(`✓ 切换确认：${confirmMessage.trim()}`);

  await page.screenshot({ path: '/tmp/lc-dirty-smoke.png' });
  report(errors, [/(engine|lowcode)/i]);
  console.log('dirty-smoke 全部通过');
} finally {
  await browser.close();
  if (temporaryPageId) {
    await api(`/api/pages/${temporaryPageId}`, { method: 'DELETE' }).catch((error) => {
      console.warn('删除临时页面失败：', error.message);
    });
  }
}
