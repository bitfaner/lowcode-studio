import { button, check, checkEqual, launch, report } from './smoke-utils.mjs';

/**
 * 页面管理冒烟：新建页面（表单校验 → 创建 → 跳转）与删除页面（确认 → 跳转回其他页面）。
 * 异常退出时会清理测试中创建的页面。
 * 需要先启动 pnpm dev:server / dev:studio。
 */
const STUDIO = process.env.STUDIO_URL ?? 'http://127.0.0.1:5173';
const API = process.env.API_URL ?? 'http://127.0.0.1:3000';
const PAGE_NAME = '冒烟页面';

const authHeaders = process.env.STUDIO_TOKEN
  ? { authorization: `Bearer ${process.env.STUDIO_TOKEN}` }
  : {};

async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...authHeaders,
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${path} -> ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

const status = async (path) => (await fetch(`${API}${path}`, { headers: authHeaders })).status;

const app = (await api('/api/apps/app_demo/pages')).app;
const pagesBefore = (await api('/api/apps/app_demo/pages')).pages ?? [];
if (pagesBefore.length === 0) throw new Error('应用下没有页面，请先运行 node tools/seed-demo.mjs');
const basePage = pagesBefore[0];

let createdId = null;
const { browser, page, errors } = await launch();

let confirmMessage = '';
page.on('dialog', async (dialog) => {
  confirmMessage = dialog.message();
  await dialog.accept();
});

try {
  await page.goto(`${STUDIO}/?pageId=${basePage.id}&autosave=0`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  const header = page.locator('.lc-studio-header');
  await header.waitFor({ timeout: 30000 });
  await button(header, '新建').waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  check(await button(header, '新建').isEnabled(), '新建按钮未启用，设计器可能未就绪');

  // 1. 打开新建弹窗：slug 有默认值
  await button(header, '新建').click();
  const modal = page.locator('.ant-modal').filter({ hasText: '新建页面' }).first();
  await modal.waitFor({ timeout: 10000 });
  const defaultSlug = await modal.locator('input#slug').inputValue();
  check(defaultSlug.startsWith('page-'), `新建弹窗的默认标识不符：${defaultSlug}`);
  console.log(`✓ 新建弹窗默认标识：${defaultSlug}`);

  // 2. 空名称提交 → 表单校验
  await button(modal, '创建').click();
  await page.waitForTimeout(600);
  const nameError = (
    await modal.locator('.ant-form-item-explain-error').first().textContent()
  )?.trim();
  checkEqual(nameError, '请输入页面名称', '空名称提交未给出校验错误');
  console.log(`✓ 空名称校验：${nameError}`);

  // 3. 填写并创建（类型改为列表页）
  await modal.locator('input#name').fill(PAGE_NAME);
  const slug = await modal.locator('input#slug').inputValue();
  await modal.locator('.ant-select').first().click();
  await page
    .locator('.ant-select-dropdown:visible .ant-select-item-option')
    .filter({ hasText: '列表页' })
    .first()
    .click();
  await button(modal, '创建').click();

  await page.waitForURL((url) => url.searchParams.get('pageId') !== basePage.id, { timeout: 60000 });
  await page.waitForTimeout(3000);
  createdId = new URL(page.url()).searchParams.get('pageId');
  const created = (await api(`/api/pages/${createdId}`)).page;
  checkEqual(created.name, PAGE_NAME, '新建页面名称不符');
  checkEqual(created.type, 'list', '新建页面类型不符');
  checkEqual(created.hasDraft, false, '新建页面不应自带草稿');
  checkEqual(created.slug, slug, '新建页面标识与弹窗不一致');
  check((await header.innerText()).includes(PAGE_NAME), '顶栏未显示新建页面');
  console.log(`✓ 已创建页面 ${created.name}（${created.id}，type=${created.type}）`);

  // 4. 删除当前页面
  await button(header, '删除').click();
  await page.waitForURL((url) => url.searchParams.get('pageId') !== createdId, { timeout: 60000 });
  await page.waitForTimeout(2000);
  check(confirmMessage.includes(PAGE_NAME), `删除确认文案未包含页面名：${confirmMessage}`);
  checkEqual(await status(`/api/pages/${createdId}`), 404, '删除后页面仍然存在');
  const pagesAfter = (await api(`/api/apps/app_demo/pages`)).pages ?? [];
  checkEqual(pagesAfter.length, pagesBefore.length, '删除后页面数量未回到初始值');
  console.log(`✓ 已删除页面（确认文案：${confirmMessage}）`);

  await page.screenshot({ path: '/tmp/lc-page-management-smoke.png' });
  report(errors, [/(engine|lowcode)/i]);
  console.log('page-management-smoke 全部通过');
} finally {
  await browser.close();
  // 断言失败时也清理测试页面，避免残留
  if (createdId && (await status(`/api/pages/${createdId}`)) === 200) {
    await fetch(`${API}/api/pages/${createdId}`, { method: 'DELETE', headers: authHeaders }).catch(
      () => undefined,
    );
    console.warn(`已清理残留页面 ${createdId}`);
  }
}
