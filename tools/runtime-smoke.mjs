import { button, check, checkEqual, drawerState, launch, report } from './smoke-utils.mjs';

/**
 * 运行时冒烟：列表加载 → 查询 → 新建抽屉 → 编辑回填。
 * 需要先启动 pnpm dev:server / dev:runtime，并执行过 node tools/seed-demo.mjs。
 */
const RUNTIME = process.env.RUNTIME_URL ?? 'http://127.0.0.1:5174';
const API = process.env.API_URL ?? 'http://127.0.0.1:3000';

async function resolvePageId() {
  if (process.env.PAGE_ID) return process.env.PAGE_ID;
  const payload = await (await fetch(`${API}/api/apps/app_demo/pages`)).json();
  const page =
    payload.pages?.find((item) => item.slug === 'users') ??
    payload.pages?.find((item) => item.type === 'list');
  if (!page) throw new Error('未找到演示列表页，请先运行 node tools/seed-demo.mjs');
  return page.id;
}

const pageId = await resolvePageId();
const { browser, page, errors } = await launch();

try {
  await page.goto(`${RUNTIME}/?page=${pageId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.lc-page', { timeout: 20000 });
  await page.waitForSelector('.ant-table tbody tr.ant-table-row', { timeout: 20000 });
  console.log('✓ 运行时页面已渲染');

  // 1. 列表基础信息
  const title = (await page.locator('.lc-page h4').first().textContent())?.trim();
  checkEqual(title, '用户管理', '页面标题不符');

  const rows = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.ant-table tbody tr.ant-table-row')].map((row) =>
        [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim() ?? ''),
      ),
    );

  const initialRows = await rows();
  check(initialRows.length > 0, '列表没有数据');
  check(/^共 \d+ 条$/.test((await page.locator('.ant-pagination-total-text').first().textContent())?.trim()),
    '分页总数文案缺失');
  const [firstName, phone] = [initialRows[0][1], initialRows[0][2]];
  check(Boolean(firstName), '首行姓名列为空');
  console.log(`✓ 列表加载 ${initialRows.length} 行，首行 ${firstName} / ${phone}`);

  // 2. 查询条件下发到列表
  const totalBefore = (await page.locator('.ant-pagination-total-text').first().textContent())?.trim();
  await page.locator('input[name="keyword"]').fill('张');
  await button(page.locator('.lc-page'), '查询').click();
  await page.waitForTimeout(1200);
  const filteredRows = await rows();
  const totalAfter = (await page.locator('.ant-pagination-total-text').first().textContent())?.trim();
  check(filteredRows.length > 0, '按关键字查询后没有结果');
  check(
    filteredRows.every((row) => row[1].includes('张')),
    `查询结果未按关键字过滤：${JSON.stringify(filteredRows.map((row) => row[1]))}`,
  );
  check(totalAfter !== totalBefore, `查询未刷新总数（仍为 ${totalAfter}）`);
  console.log(`✓ 查询生效：${totalBefore} → ${totalAfter}`);

  // 3. 新建：工具栏 → 抽屉表单
  await button(page.locator('.lc-page'), '新建').click();
  await page.waitForSelector('.ant-drawer-content-wrapper', { timeout: 10000 });
  const created = await drawerState(page);
  check(created.visible, '新建抽屉未打开');
  checkEqual(created.title, '新建', '新建抽屉标题不符');
  const emptyName = created.inputs.find((input) => input.name === 'name');
  check(emptyName !== undefined, '抽屉表单没有渲染出 name 字段');
  checkEqual(emptyName.value, '', '新建态 name 应为空');

  await page.locator('.ant-drawer-body input[name="name"]').fill('张新增');
  await page.locator('.ant-drawer-body input[name="phone"]').fill('13900001111');
  await button(page.locator('.ant-drawer'), '保存').click();
  await page.waitForTimeout(1200);
  const createdAlert = (await page.locator('.lc-page .ant-alert').first().textContent())?.trim();
  checkEqual(createdAlert, '保存成功', '新建提交未返回成功提示');
  console.log('✓ 新建抽屉提交成功');

  // 4. 编辑：抽屉回填行数据（此前这条链路只能靠 Lit 的 DOM 桥接，已失效）
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  const editedRow = (await rows())[0];
  await page.locator('.ant-table tbody tr.ant-table-row').first().locator('button', { hasText: /编\s*辑/ }).click();
  await page.waitForSelector('.ant-drawer-content-wrapper', { timeout: 10000 });
  await page.waitForTimeout(600);
  const edited = await drawerState(page);
  check(edited.visible, '编辑抽屉未打开');
  checkEqual(edited.title, '编辑', '编辑抽屉标题不符');
  checkEqual(edited.inputs.find((input) => input.name === 'name')?.value, editedRow[1], '编辑态姓名未回填');
  checkEqual(edited.inputs.find((input) => input.name === 'phone')?.value, editedRow[2], '编辑态手机号未回填');
  console.log(`✓ 编辑抽屉回填：${editedRow[1]} / ${editedRow[2]}`);

  await page.screenshot({ path: '/tmp/lc-runtime-smoke.png' });
  report(errors);
  console.log('runtime-smoke 全部通过');
} finally {
  await browser.close();
}
