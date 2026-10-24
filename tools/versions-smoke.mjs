import { button, check, checkEqual, launch, report, waitForText } from './smoke-utils.mjs';

/**
 * 版本历史冒烟：列出历史版本 → 回滚到历史版本 → 运行时版本指针切换。
 * 结束后把发布指针还原到脚本开始时的版本。
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

const readPage = async (pageId) => (await api(`/api/pages/${pageId}`)).page;
const readVersions = async (pageId) => (await api(`/api/pages/${pageId}/versions`)).versions;

const pageId =
  process.env.PAGE_ID ??
  (await (async () => {
    const apps = await api('/api/apps/app_demo/pages');
    const page = apps.pages?.find((item) => item.slug === 'users') ?? apps.pages?.[0];
    if (!page) throw new Error('应用下没有页面，请先运行 node tools/seed-demo.mjs');
    return page.id;
  })());

const original = await readPage(pageId);

// 至少需要两个版本来验证回滚
let versions = await readVersions(pageId);
if (versions.length < 2) {
  if (!original.hasDraft) {
    await api(`/api/pages/${pageId}/draft`, {
      method: 'PUT',
      body: JSON.stringify({ schema: { componentsTree: [{ componentName: 'Page', props: { title: '版本冒烟' } }] } }),
    });
  }
  while (versions.length < 2) {
    await api(`/api/pages/${pageId}/publish`, { method: 'POST', body: JSON.stringify({}) });
    versions = await readVersions(pageId);
  }
}

const originalVersion = (await readPage(pageId)).currentVersion;
const target = versions.find((item) => item.version !== originalVersion);
if (!target) throw new Error('没有可用于回滚的历史版本');

const { browser, page, errors } = await launch();

let confirmMessage = '';
page.on('dialog', async (dialog) => {
  confirmMessage = dialog.message();
  await dialog.accept();
});

try {
  await page.goto(`${STUDIO}/?pageId=${pageId}&autosave=0`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  const header = page.locator('.lc-studio-header');
  await header.waitFor({ timeout: 30000 });
  await button(header, '版本').waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  check(await button(header, '版本').isEnabled(), '版本按钮未启用，设计器可能未就绪');

  await button(header, '版本').click();
  const modal = page.locator('.ant-modal').filter({ hasText: '版本历史' }).first();
  await modal.waitFor({ timeout: 10000 });
  await modal.locator('.ant-list-item').first().waitFor({ timeout: 10000 });

  const listed = await modal.locator('.ant-list-item').count();
  checkEqual(listed, versions.length, '版本历史条数与接口不一致');
  const modalText = (await modal.innerText()).replace(/\s+/g, ' ');
  check(modalText.includes(`v${originalVersion}`), `版本历史中缺少当前版本 v${originalVersion}`);
  check(modalText.includes('当前'), '当前版本未标记「当前」');
  console.log(`✓ 版本历史：${listed} 个版本，当前 v${originalVersion}`);

  // 回滚到历史版本
  await modal
    .locator('.ant-list-item')
    .filter({ hasText: `v${target.version} ` })
    .first()
    .locator('button', { hasText: /回\s*滚/ })
    .click();
  await page.waitForTimeout(1500);
  check(confirmMessage.includes('回滚'), `回滚确认文案不符：${confirmMessage}`);

  const afterRollback = await readPage(pageId);
  checkEqual(afterRollback.currentVersion, target.version, '回滚后当前版本号未切换');
  await waitForText(header, `已回滚到 v${target.version}`);
  console.log(`✓ 回滚到 v${target.version}（确认文案：${confirmMessage}）`);

  // 运行时按当前版本指针读取
  const runtimePayload = await (await fetch(`${API}/api/runtime/pages/${pageId}`)).json();
  checkEqual(runtimePayload.version, target.version, '运行时读取的版本与回滚结果不一致');
  console.log(`✓ 运行时读取 v${runtimePayload.version}`);

  await page.screenshot({ path: '/tmp/lc-versions-smoke.png' });
  report(errors, [/(engine|lowcode)/i]);
  console.log('versions-smoke 全部通过');
} finally {
  await browser.close();
  // 还原发布指针
  if (originalVersion && originalVersion !== (await readPage(pageId)).currentVersion) {
    await api(`/api/pages/${pageId}/rollback/${originalVersion}`, { method: 'POST' });
  }
}
