import { checkEqual, launch, report, waitForText } from './smoke-utils.mjs';

/**
 * 自动保存冒烟：编辑画布后 2s 防抖写入草稿，并在顶栏提示「已自动保存」。
 * 脚本结束后还原原始草稿，避免污染示例页面。
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

const pageId =
  process.env.PAGE_ID ??
  (await (async () => {
    const apps = await api('/api/apps/app_demo/pages');
    const page = apps.pages?.find((item) => item.slug === 'users') ?? apps.pages?.[0];
    if (!page) throw new Error('应用下没有页面，请先运行 node tools/seed-demo.mjs');
    return page.id;
  })());

const readDraft = async () => (await api(`/api/pages/${pageId}`)).page.draftSchema;
const originalDraft = await readDraft();
if (!originalDraft) throw new Error('演示页面没有草稿，无法还原；请先运行 node tools/seed-demo.mjs');

const rootTitle = (schema) => schema?.componentsTree?.[0]?.props?.title ?? null;
const originalTitle = rootTitle(originalDraft);
const marker = `autosave-${Date.now()}`;

const { browser, page, errors } = await launch();

try {
  // 注意：不带 autosave=0，自动保存必须保持开启
  await page.goto(`${STUDIO}/?pageId=${pageId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const header = page.locator('.lc-studio-header');
  await header.waitFor({ timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.waitForFunction(() => Boolean(window.AliLowCodeEngine?.project?.currentDocument), null, {
    timeout: 60000,
  });

  await page.evaluate((value) => {
    const doc = window.AliLowCodeEngine.project.currentDocument;
    doc.root.setPropValue('title', value);
  }, marker);

  // 2s 防抖 + 网络往返，留足余量
  const deadline = Date.now() + 15000;
  let savedDraft = null;
  while (Date.now() < deadline) {
    savedDraft = await readDraft();
    if (rootTitle(savedDraft) === marker) break;
    await page.waitForTimeout(500);
  }

  checkEqual(rootTitle(savedDraft), marker, '自动保存未把改动写入草稿');
  // 草稿先落库、状态文案随后才渲染，这里轮询等待，避免竞态
  await waitForText(header, '已自动保存');
  console.log(`✓ 自动保存生效：${marker}`);

  await page.screenshot({ path: '/tmp/lc-autosave-smoke.png' });
  report(errors, [/(engine|lowcode)/i]);
  console.log('autosave-smoke 全部通过');
} finally {
  await browser.close();
  // 还原原始草稿
  await api(`/api/pages/${pageId}/draft`, {
    method: 'PUT',
    body: JSON.stringify({ schema: originalDraft }),
  });
  checkEqual(rootTitle(await readDraft()), originalTitle, '还原原始草稿失败');
  console.log(`✓ 草稿已还原：${originalTitle}`);
}
