/**
 * 初始化演示数据：用户表单页 + 用户管理列表页。
 *
 * 用法：先启动服务端（pnpm dev:server），再执行 node tools/seed-demo.mjs
 * 已存在时默认跳过；需要覆盖并重新发布时加 FORCE=1。
 */
const API = process.env.API_URL ?? 'http://127.0.0.1:3000';
const force = process.env.FORCE === '1';

async function request(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(process.env.STUDIO_TOKEN
        ? { authorization: `Bearer ${process.env.STUDIO_TOKEN}` }
        : {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

const componentsMap = [
  { componentName: 'Page', package: 'lc-materials', version: '0.1.0', exportName: 'Page' },
];

function formSchema() {
  return {
    version: '1.0.0',
    componentsMap,
    componentsTree: [
      {
        componentName: 'Page',
        props: { title: '用户表单', pageType: 'form' },
        children: [
          {
            componentName: 'LcForm',
            props: {
              submitText: '保存',
              submit: { url: '/api/mock/users', method: 'POST' },
              success: { message: '保存成功', action: 'close' },
            },
            children: [
              {
                componentName: 'LcInput',
                props: {
                  name: 'name',
                  label: '姓名',
                  required: true,
                  rules: [{ required: true, message: '请输入姓名' }],
                },
              },
              { componentName: 'LcInput', props: { name: 'phone', label: '手机号' } },
              {
                componentName: 'LcSelect',
                props: {
                  name: 'status',
                  label: '状态',
                  options: [
                    { label: '启用', value: 'active' },
                    { label: '停用', value: 'disabled' },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

function listSchema(formPageId) {
  return {
    version: '1.0.0',
    componentsMap,
    componentsTree: [
      {
        componentName: 'Page',
        props: {
          title: '用户管理',
          pageType: 'list',
          rowKey: 'id',
          pageSize: 10,
          formPageId,
          dataSource: {
            url: '/api/mock/users',
            method: 'GET',
            params: {
              page: '{{page}}',
              pageSize: '{{pageSize}}',
              keyword: '{{query.keyword}}',
              status: '{{query.status}}',
              sortField: '{{sort.field}}',
              sortOrder: '{{sort.order}}',
            },
            response: { rows: 'data.records', total: 'data.total' },
          },
          rowActions: [
            { key: 'edit', title: '编辑', formPageId, mode: 'edit' },
            {
              key: 'delete',
              title: '删除',
              type: 'danger',
              confirm: '确认删除该用户？',
              request: { url: '/api/mock/users/delete', method: 'POST' },
            },
          ],
        },
        children: [
          {
            componentName: 'LcQueryForm',
            props: { columns: 3 },
            children: [
              {
                componentName: 'LcInput',
                props: { name: 'keyword', label: '关键字', placeholder: '姓名或手机号' },
              },
              {
                componentName: 'LcSelect',
                props: {
                  name: 'status',
                  label: '状态',
                  options: [
                    { label: '启用', value: 'active' },
                    { label: '停用', value: 'disabled' },
                  ],
                },
              },
            ],
          },
          {
            componentName: 'LcToolbar',
            props: {
              actions: [
                { key: 'create', title: '新建', type: 'primary', formPageId, mode: 'create' },
                {
                  key: 'batchDelete',
                  title: '批量删除',
                  type: 'danger',
                  requireSelection: true,
                  confirm: '确认删除选中用户？',
                  request: { url: '/api/mock/users/delete', method: 'POST' },
                },
              ],
            },
          },
          {
            componentName: 'LcTable',
            props: {
              selection: true,
              pagination: true,
              columns: [
                { dataIndex: 'name', title: '姓名', sortable: true },
                { dataIndex: 'phone', title: '手机号', width: 160 },
                {
                  dataIndex: 'status',
                  title: '状态',
                  type: 'tag',
                  valueEnum: {
                    active: { text: '启用', color: 'success' },
                    disabled: { text: '停用', color: 'neutral' },
                  },
                },
                { dataIndex: 'createdAt', title: '创建时间', type: 'date', width: 180 },
              ],
            },
          },
        ],
      },
    ],
  };
}

async function ensurePage(pages, payload) {
  const existing = pages.find((page) => page.slug === payload.slug);
  if (existing) return { page: existing, created: false };
  const result = await request('/api/apps/app_demo/pages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { page: result.page, created: true };
}

const { pages } = await request('/api/apps/app_demo/pages');

const form = await ensurePage(pages, {
  name: '用户表单',
  slug: 'user-form',
  type: 'form',
});
const list = await ensurePage(pages, {
  name: '用户管理',
  slug: 'users',
  type: 'list',
});

const shouldWrite = force || form.created || form.page.currentVersion === null;
const shouldWriteList = force || list.created || list.page.currentVersion === null;

if (shouldWrite) {
  await request(`/api/pages/${form.page.id}/draft`, {
    method: 'PUT',
    body: JSON.stringify({ schema: formSchema() }),
  });
  const published = await request(`/api/pages/${form.page.id}/publish`, {
    method: 'POST',
    body: '{}',
  });
  console.log(`form page ready: ${form.page.id} (v${published.version})`);
} else {
  console.log(`form page exists: ${form.page.id} (v${form.page.currentVersion})`);
}

if (shouldWriteList) {
  await request(`/api/pages/${list.page.id}/draft`, {
    method: 'PUT',
    body: JSON.stringify({ schema: listSchema(form.page.id) }),
  });
  const published = await request(`/api/pages/${list.page.id}/publish`, {
    method: 'POST',
    body: '{}',
  });
  console.log(`list page ready: ${list.page.id} (v${published.version})`);
} else {
  console.log(`list page exists: ${list.page.id} (v${list.page.currentVersion})`);
}

console.log(`runtime url: ${API}/runtime/?page=${list.page.id}`);
