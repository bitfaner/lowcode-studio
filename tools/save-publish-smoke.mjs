import { button, check, checkEqual, launch, report, waitForText } from './smoke-utils.mjs';

/**
 * 设计器冒烟：加载草稿 → 保存 → 发布 → 运行时读取同一份快照。
 * 需要先启动 pnpm dev:server / dev:studio，并执行过 node tools/seed-demo.mjs。
 */
const STUDIO = process.env.STUDIO_URL ?? 'http://127.0.0.1:5173';
const API = process.env.API_URL ?? 'http://127.0.0.1:3000';

const pageId =
  process.env.PAGE_ID ??
  (await (async () => {
    const payload = await (await fetch(`${API}/api/apps/app_demo/pages`)).json();
    const page = payload.pages?.find((item) => item.slug === 'users') ?? payload.pages?.[0];
    if (!page) throw new Error('应用下没有页面，请先运行 node tools/seed-demo.mjs');
    return page.id;
  })());

const readPage = async () => (await (await fetch(`${API}/api/pages/${pageId}`)).json()).page;

const { browser, page, errors } = await launch();
const header = page.locator('.lc-studio-header');

try {
  await page.goto(`${STUDIO}/?pageId=${pageId}&autosave=0`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await header.waitFor({ timeout: 30000 });
  // 设计器就绪后「保存」才可用
  await button(header, '保存').waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  check(await button(header, '保存').isEnabled(), '保存按钮未启用，设计器可能未就绪');

  const frame = page.frameLocator('iframe.lc-simulator-content-frame').first();
  await frame.locator('.lc-page').waitFor({ timeout: 20000 });
  const canvasTitle = (await frame.locator('.lc-page h4').first().textContent())?.trim();
  check(Boolean(canvasTitle), '画布未渲染页面标题');
  console.log(`✓ 设计器已加载页面，画布标题「${canvasTitle}」`);

  // 1. 保存草稿
  await button(header, '保存').click();
  await page.waitForTimeout(1500);
  await waitForText(header, '草稿已保存');
  const saved = await readPage();
  check(saved.hasDraft, '保存后草稿状态仍为 false');
  checkEqual(saved.draftSchema?.componentsTree?.[0]?.componentName, 'Page', '草稿 schema 结构异常');
  console.log(`✓ 草稿已保存（${saved.updatedAt}）`);

  // 2. 发布
  const versionBefore = saved.currentVersion ?? 0;
  await button(header, '发布').click();
  await waitForText(header, '已发布');
  const published = await readPage();
  checkEqual(published.currentVersion, versionBefore + 1, '发布后当前版本号未递增');
  console.log(`✓ 已发布 v${published.currentVersion}`);

  // 3. 运行时读取的版本必须与设计器一致
  const runtimePayload = await (
    await fetch(`${API}/api/runtime/pages/${pageId}`)
  ).json();
  checkEqual(runtimePayload.version, published.currentVersion, '运行时版本与当前版本不一致');
  checkEqual(
    runtimePayload.schema?.componentsTree?.[0]?.componentName,
    'Page',
    '运行时 payload 的 schema 结构异常',
  );
  console.log(`✓ 运行时读取 v${runtimePayload.version}`);

  await page.screenshot({ path: '/tmp/lc-save-publish-smoke.png' });
  report(errors, [/(engine|lowcode)/i]);
  console.log('save-publish-smoke 全部通过');
} finally {
  await browser.close();
}
