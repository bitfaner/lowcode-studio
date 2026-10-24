import { button, check, checkEqual, launch, report } from './smoke-utils.mjs';

/**
 * 运行时全链路冒烟：列表请求 / 查询参数 / 分页 / 排序 / 行删除都经数据源代理。
 *
 * 用 route 拦截 `/api/datasource/proxy`，既验证 DataClient 发出的请求内容，
 * 也让脚本不依赖后端的真实业务数据。
 * 需要先启动 pnpm dev:server / dev:runtime，并执行过 node tools/seed-demo.mjs。
 */
const RUNTIME = process.env.RUNTIME_URL ?? 'http://127.0.0.1:5174';
const API = process.env.API_URL ?? 'http://127.0.0.1:3000';

const payloads = [];
const { browser, page, errors } = await launch();

await page.route('**/api/datasource/proxy', async (route) => {
  const payload = JSON.parse(route.request().postData() ?? '{}');
  payloads.push(payload);

  if (String(payload.url ?? '').includes('/delete')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    return;
  }

  const pageNo = Number(payload.params?.page ?? 1);
  const pageSize = Number(payload.params?.pageSize ?? 10);
  const keyword = payload.params?.keyword ?? '';
  const rows = Array.from({ length: pageSize }, (_, index) => ({
    id: (pageNo - 1) * pageSize + index + 1,
    name: `${keyword ? `${keyword}-` : ''}第${pageNo}页-${index + 1}`,
    phone: `1380000${String(index).padStart(4, '0')}`,
    status: index % 2 === 0 ? 'active' : 'disabled',
    createdAt: '2026-09-01 10:00:00',
  }));
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { records: rows, total: 21 } }),
  });
});

const listRequests = () => payloads.filter((payload) => !String(payload.url).includes('/delete'));
const deleteRequests = () => payloads.filter((payload) => String(payload.url).includes('/delete'));

const rows = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.ant-table tbody tr.ant-table-row')].map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim() ?? ''),
    ),
  );

try {
  const apps = await (await fetch(`${API}/api/apps/app_demo/pages`)).json();
  const listPage = apps.pages?.find((item) => item.slug === 'users');
  if (!listPage) throw new Error('未找到演示列表页，请先运行 node tools/seed-demo.mjs');

  await page.goto(`${RUNTIME}/?page=${listPage.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.ant-table tbody tr.ant-table-row', { timeout: 20000 });

  // 1. 首次加载：走代理，带上分页参数
  const first = listRequests()[0];
  check(Boolean(first), '没有发出数据源请求');
  checkEqual(Number(first.params?.page), 1, '首次请求 page 参数不符');
  checkEqual(Number(first.params?.pageSize), 10, '首次请求 pageSize 参数不符');
  const firstRows = await rows();
  check(firstRows.length === 10, `首屏应渲染 10 行，实际 ${firstRows.length}`);
  checkEqual(firstRows[0][1], '第1页-1', '首屏数据未使用代理响应');
  console.log(`✓ 首次加载：page=1 pageSize=10，渲染 ${firstRows.length} 行`);

  // 2. 查询条件透传
  await page.locator('input[name="keyword"]').fill('李');
  await button(page.locator('.lc-page'), '查询').click();
  await page.waitForTimeout(1200);
  const queryRequest = listRequests().at(-1);
  checkEqual(queryRequest?.params?.keyword, '李', '查询条件未透传到数据源');
  checkEqual((await rows())[0][1], '李-第1页-1', '查询响应未回填表格');
  console.log('✓ 查询条件已透传：keyword=李');

  // 3. 翻页
  await page.locator('.ant-pagination-next button, .ant-pagination-next').first().click();
  await page.waitForTimeout(1200);
  const pageRequest = listRequests().at(-1);
  checkEqual(Number(pageRequest?.params?.page), 2, '翻页请求未携带 page=2');
  checkEqual((await rows())[0][1], '李-第2页-1', '第 2 页数据未回填');
  console.log('✓ 翻页：page=2');

  // 4. 排序
  await page.locator('.ant-table thead th').filter({ hasText: '姓名' }).first().click();
  await page.waitForTimeout(1200);
  const sortRequest = listRequests().at(-1);
  checkEqual(sortRequest?.params?.sortField, 'name', '排序请求未携带 sortField');
  checkEqual(sortRequest?.params?.sortOrder, 'asc', '排序请求未携带 sortOrder=asc');
  console.log('✓ 排序：sortField=name sortOrder=asc');

  // 5. 行删除（confirm + 代理请求）
  page.on('dialog', (dialog) => void dialog.accept());
  const targetRow = (await rows())[0];
  await page.locator('.ant-table tbody tr.ant-table-row').first().locator('button', { hasText: /删\s*除/ }).click();
  await page.waitForTimeout(1500);
  const deleted = deleteRequests().at(-1);
  check(Boolean(deleted), '删除操作没有发出请求');
  check(String(deleted.url).includes('/delete'), `删除请求地址异常：${deleted.url}`);
  checkEqual(deleted.body?.name, targetRow[1], '删除请求未携带行数据');
  const alert = (await page.locator('.lc-page .ant-alert').first().textContent())?.trim();
  checkEqual(alert, '删除成功', '删除后未提示成功');
  console.log(`✓ 行删除：${targetRow[1]}，请求 ${deleted.url}`);

  await page.screenshot({ path: '/tmp/lc-list-live-smoke.png' });
  report(errors);
  console.log('list-live-smoke 全部通过');
} finally {
  await browser.close();
}
