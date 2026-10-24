import { check, launch, report } from './smoke-utils.mjs';

/**
 * 设计态冒烟：在引擎画布里搭一个列表页，验证设计态渲染与「不发请求」策略。
 * 需要先启动 pnpm dev:server / dev:studio。
 */
const STUDIO = process.env.STUDIO_URL ?? 'http://127.0.0.1:5173';

const { browser, page, errors } = await launch();

// 设计态不应发出任何数据源请求，这里统计以便断言
const proxyRequests = [];
await page.route('**/api/datasource/proxy', async (route) => {
  proxyRequests.push(route.request().postData());
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '{"data":{"records":[],"total":0}}',
  });
});

try {
  await page.goto(`${STUDIO}/?autosave=0`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.AliLowCodeEngine?.project?.currentDocument), null, {
    timeout: 60000,
  });
  await page.waitForTimeout(4000);

  const built = await page.evaluate(() => {
    const doc = window.AliLowCodeEngine.project.currentDocument;
    // 从干净的画布开始，避免默认 schema 里的物料干扰断言（NodeChildren 不可迭代，按 size/get 遍历）
    const kids = doc.root.children;
    for (let index = kids.size - 1; index >= 0; index -= 1) kids.delete(kids.get(index));
    doc.root.setPropValue('title', '用户管理');
    doc.root.setPropValue('rowKey', 'id');
    doc.root.setPropValue('pageSize', 10);
    doc.root.setPropValue('dataSource', {
      url: '/api/mock/users',
      method: 'GET',
      params: { page: '{{page}}', pageSize: '{{pageSize}}' },
      response: { rows: 'data.records', total: 'data.total' },
    });
    doc.root.setPropValue('rowActions', [
      { key: 'edit', title: '编辑', formPageId: 'page_user_form', mode: 'edit' },
    ]);

    const queryForm = doc.createNode({
      componentName: 'LcQueryForm',
      props: { columns: 3 },
      children: [
        {
          componentName: 'LcInput',
          props: { name: 'keyword', label: '关键字', placeholder: '姓名/手机号' },
        },
      ],
    });
    doc.root.children.insert(queryForm);

    const toolbar = doc.createNode({
      componentName: 'LcToolbar',
      props: {
        actions: [
          { key: 'create', title: '新建', type: 'primary' },
          { key: 'batchDelete', title: '批量删除', type: 'danger', requireSelection: true },
        ],
      },
    });
    doc.root.children.insert(toolbar);

    const table = doc.createNode({
      componentName: 'LcTable',
      props: {
        selection: true,
        pagination: true,
        columns: [
          { dataIndex: 'name', title: '名称', sortable: true },
          {
            dataIndex: 'status',
            title: '状态',
            type: 'tag',
            valueEnum: {
              active: { text: '启用', color: 'success' },
              disabled: { text: '停用', color: 'neutral' },
            },
          },
          { dataIndex: 'createdAt', title: '创建时间', type: 'date' },
        ],
      },
    });
    doc.root.children.insert(table);

    return doc.root.children.map((child) => child.componentName);
  });
  console.log('✓ 已插入物料:', built.join(', '));

  const frameElement = await page.locator('iframe.lc-simulator-content-frame').first().elementHandle();
  const frame = await frameElement.contentFrame();
  await frame.waitForSelector('.lc-page', { timeout: 20000 });
  await frame.waitForSelector('.ant-table tbody tr.ant-table-row', { timeout: 20000 });

  const view = () =>
    frame.evaluate(() => ({
      title: document.querySelector('.lc-page h4')?.textContent?.trim(),
      rows: [...document.querySelectorAll('.ant-table tbody tr.ant-table-row')].map((row) =>
        [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim() ?? ''),
      ),
      headers: [...document.querySelectorAll('.ant-table thead th')].map((th) =>
        (th.textContent ?? '').trim(),
      ),
      alert: document.querySelector('.lc-page .ant-alert')?.textContent?.trim() ?? null,
      toolbar: [...document.querySelectorAll('.ant-space button')].map((item) => ({
        text: (item.textContent ?? '').replace(/\s+/g, ''),
        disabled: item.disabled,
      })),
    }));

  const initial = await view();
  check(initial.rows.length > 0, '设计态表格没有示例数据');
  check(
    initial.rows.every((row) => row[1]?.startsWith('示例数据')),
    `设计态应展示示例数据，实际 ${JSON.stringify(initial.rows.map((row) => row[1]))}`,
  );
  check(initial.headers.includes('名称') && initial.headers.includes('状态'), '列配置未生效');
  check(initial.headers.includes('操作'), '页面级 rowActions 未渲染出操作列');
  console.log(`✓ 设计态渲染 ${initial.rows.length} 行示例数据，表头 ${initial.headers.join('|')}`);

  // 未选中时批量删除应禁用（设计态画布不响应勾选，只校验初始禁用态）
  const batchBefore = initial.toolbar.find((item) => item.text === '批量删除');
  check(batchBefore?.disabled === true, '未选中数据时批量删除应为禁用');
  // 行操作在设计态只提示，不发请求
  await frame.click('.ant-table tbody tr.ant-table-row button >> nth=0');
  await page.waitForTimeout(800);
  const afterAction = await view();
  check(
    afterAction.alert?.includes('设计态') ?? false,
    `行操作未给出设计态提示，实际提示：${afterAction.alert}`,
  );
  check(proxyRequests.length === 0, `设计态不应发出数据源请求，实际 ${proxyRequests.length} 次`);
  console.log(`✓ 设计态行操作提示：${afterAction.alert}`);

  await page.screenshot({ path: '/tmp/lc-list-smoke.png' });
  report(errors, [/(engine|lowcode)/i]);
  console.log('list-smoke 全部通过');
} finally {
  await browser.close();
}
