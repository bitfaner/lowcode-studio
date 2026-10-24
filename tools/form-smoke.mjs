import { button, check, checkEqual, launch, report } from './smoke-utils.mjs';

/**
 * 表单冒烟：必填校验 → 联动隐藏/恢复 → 合法值提交成功。
 *
 * 跑在**运行时**（`preview=1` 读草稿）而不是设计器画布：引擎的选中层会拦截画布内的
 * 点击事件，表单交互只能在真实运行时验证。脚本会先把测试用 schema 写进表单页草稿，
 * 结束后还原原始草稿。
 *
 * 需要先启动 pnpm dev:server / dev:runtime，并执行过 node tools/seed-demo.mjs。
 */
const RUNTIME = process.env.RUNTIME_URL ?? 'http://127.0.0.1:5174';
const API = process.env.API_URL ?? 'http://127.0.0.1:3000';

const authHeaders = () => {
  const token = process.env.STUDIO_TOKEN;
  return token ? { authorization: `Bearer ${token}` } : {};
};

async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${path} -> ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

function formSchema() {
  return {
    version: '1.0.0',
    componentsMap: [{ componentName: 'Page', package: 'lc-materials', version: '0.1.0', exportName: 'Page' }],
    componentsTree: [
      {
        componentName: 'Page',
        props: { title: '表单冒烟', pageType: 'form' },
        children: [
          {
            componentName: 'LcForm',
            props: {
              layout: 'vertical',
              showSubmit: true,
              submitText: '提交',
              resetText: '重置',
              submit: { url: '/api/mock/users', method: 'POST' },
              success: { message: '保存成功' },
              linkages: [
                {
                  when: { field: 'username', op: 'eq', value: 'hide' },
                  then: [{ target: 'extra', action: 'hide' }],
                },
              ],
            },
            children: [
              {
                componentName: 'LcInput',
                props: {
                  name: 'username',
                  label: '姓名',
                  placeholder: '请输入姓名',
                  required: true,
                  rules: [{ required: true, message: '请输入姓名' }],
                },
              },
              {
                componentName: 'LcInput',
                props: { name: 'extra', label: '附加信息', placeholder: '联动演示' },
              },
            ],
          },
        ],
      },
    ],
  };
}

const apps = await api('/api/apps/app_demo/pages');
const formPage = apps.pages?.find((item) => item.slug === 'user-form');
if (!formPage) throw new Error('未找到演示表单页，请先运行 node tools/seed-demo.mjs');

const original = (await api(`/api/pages/${formPage.id}`)).page;

const { browser, page, errors } = await launch();

const fields = () =>
  page.evaluate(() => ({
    names: [...document.querySelectorAll('.lc-page input')].map((input) => input.name),
    errors: [...document.querySelectorAll('.ant-form-item-explain-error')].map((node) =>
      node.textContent?.trim(),
    ),
    alert: document.querySelector('.lc-page .ant-alert')?.textContent?.trim() ?? null,
  }));

try {
  await api(`/api/pages/${formPage.id}/draft`, {
    method: 'PUT',
    body: JSON.stringify({ schema: formSchema() }),
  });

  await page.goto(`${RUNTIME}/?page=${formPage.id}&preview=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('input[name="username"]', { timeout: 20000 });

  const initial = await fields();
  checkEqual(initial.names.join(','), 'username,extra', '表单字段未按 schema 渲染');
  console.log('✓ 表单渲染：username / extra');

  // 1. 空提交 → 必填错误
  await button(page.locator('.lc-page'), '提交').click();
  await page.waitForTimeout(600);
  const emptySubmit = await fields();
  check(
    emptySubmit.errors.some((text) => text?.includes('不能为空')),
    `空提交未给出必填错误，实际：${JSON.stringify(emptySubmit.errors)}`,
  );
  checkEqual(emptySubmit.alert, null, '校验未通过时不应出现提交结果提示');
  console.log(`✓ 必填校验：${emptySubmit.errors.join(' / ')}`);

  // 2. 联动隐藏
  await page.locator('input[name="username"]').fill('hide');
  await page.waitForTimeout(600);
  check(!(await fields()).names.includes('extra'), '联动规则命中后 extra 字段应隐藏');
  console.log('✓ 联动隐藏：extra 已移除');

  // 3. 条件失效 → 自动恢复
  await page.locator('input[name="username"]').fill('normal');
  await page.waitForTimeout(600);
  check((await fields()).names.includes('extra'), '联动条件失效后 extra 字段应恢复显示');
  console.log('✓ 联动恢复：extra 已显示');

  // 4. 合法值 → 提交成功（走数据源代理到内置 mock）
  await page.locator('input[name="username"]').fill('张三');
  await button(page.locator('.lc-page'), '提交').click();
  await page.waitForTimeout(1500);
  const validSubmit = await fields();
  checkEqual(validSubmit.errors.length, 0, '合法值提交不应有校验错误');
  checkEqual(validSubmit.alert, '保存成功', '提交成功提示不符');
  console.log(`✓ 提交成功：${validSubmit.alert}`);

  await page.screenshot({ path: '/tmp/lc-form-smoke.png' });
  report(errors);
  console.log('form-smoke 全部通过');
} finally {
  await browser.close();
  // 还原原始草稿，避免测试改动污染演示页面
  if (original.hasDraft) {
    await api(`/api/pages/${formPage.id}/draft`, {
      method: 'PUT',
      body: JSON.stringify({ schema: original.draftSchema }),
    });
  } else {
    console.warn('原始草稿为空，未做还原');
  }
}
