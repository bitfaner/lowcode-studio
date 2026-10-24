import { chromium } from 'playwright-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const logs = [];
page.on('console', (m) => {
  if (m.type() === 'error') logs.push(m.text());
});
page.on('pageerror', (e) => logs.push(e.message));

await page.goto('http://127.0.0.1:5173/?autosave=0', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

const built = await page.evaluate(() => {
  const doc = window.AliLowCodeEngine.project.currentDocument;
  const input = doc.createNode({
    componentName: 'LcInput',
    props: { name: 'title', label: '标题' },
  });
  doc.root.children.insert(input);
  const select = doc.createNode({
    componentName: 'LcSelect',
    props: { name: 'status', label: '状态' },
  });
  doc.root.children.insert(select);
  const form = doc.createNode({
    componentName: 'LcForm',
    props: { layout: 'vertical' },
  });
  doc.root.children.insert(form);
  doc.selection.select(input.id);
  window.__smokeNodes = { input, select, form };
  return { inputId: input.id, selectId: select.id, formId: form.id };
});
await page.waitForTimeout(1500);

const panelText = await page.evaluate(
  () => document.querySelector('.lc-right-area')?.innerText ?? '',
);
console.log('panel:', JSON.stringify(panelText.slice(0, 900)));

const toggles = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.lc-right-area *')]
    .filter((el) => el.children.length === 0 && el.textContent?.trim() === '校验规则')
    .map((el) => el.tagName);
  return labels;
});
console.log('rules label nodes:', JSON.stringify(toggles));

// 打开「校验规则」分组（如果默认折叠）
const rulesGroup = page.locator('.lc-right-area').getByText('校验规则', { exact: true }).first();
await rulesGroup.click();
await page.waitForTimeout(600);

// 添加一条校验规则
const addRule = page.locator('.lc-right-area').getByText('+ 添加规则', { exact: true }).first();
await addRule.click();
await page.waitForTimeout(800);

const rulesAfterAdd = await page.evaluate(() =>
  window.__smokeNodes.input.getPropValue('rules'),
);
console.log('rules:', JSON.stringify(rulesAfterAdd));

// 填写提示文案
const messageInput = page
  .locator('.lc-right-area input[placeholder="留空使用默认提示"]')
  .first();
if (await messageInput.count()) {
  await messageInput.fill('请输入标题');
  await page.waitForTimeout(600);
}
const rulesAfterMessage = await page.evaluate(() =>
  window.__smokeNodes.input.getPropValue('rules'),
);
console.log('rules with message:', JSON.stringify(rulesAfterMessage));

// 下拉框的选项设置器
await page.evaluate((id) => {
  const doc = window.AliLowCodeEngine.project.currentDocument;
  doc.selection.select(id);
}, built.selectId);
await page.waitForTimeout(1200);

const selectPanel = await page.evaluate(
  () => document.querySelector('.lc-right-area')?.innerText ?? '',
);
console.log('select panel has 选项:', selectPanel.includes('选项'));

const optionsGroup = page.locator('.lc-right-area').getByText('选项', { exact: true }).first();
await optionsGroup.click();
await page.waitForTimeout(600);
const addOption = page.locator('.lc-right-area').getByText('+ 添加选项', { exact: true }).first();
if (await addOption.count()) {
  await addOption.click();
  await page.waitForTimeout(800);
}
const optionsAfterAdd = await page.evaluate(() =>
  window.__smokeNodes.select.getPropValue('options'),
);
console.log('options:', JSON.stringify(optionsAfterAdd));

// 表单的联动规则设置器
await page.evaluate((id) => {
  const doc = window.AliLowCodeEngine.project.currentDocument;
  doc.selection.select(id);
}, built.formId);
await page.waitForTimeout(1200);

const linkageGroup = page
  .locator('.lc-right-area')
  .getByText('联动规则', { exact: true })
  .first();
await linkageGroup.click();
await page.waitForTimeout(600);
const addLinkage = page
  .locator('.lc-right-area')
  .getByText('+ 添加联动', { exact: true })
  .first();
if (await addLinkage.count()) {
  await addLinkage.click();
  await page.waitForTimeout(800);
}
const linkagesAfterAdd = await page.evaluate(() =>
  window.__smokeNodes.form.getPropValue('linkages'),
);
console.log('linkages:', JSON.stringify(linkagesAfterAdd));

// 列表页物料的设置器
const listNodes = await page.evaluate(() => {
  const doc = window.AliLowCodeEngine.project.currentDocument;
  const table = doc.createNode({
    componentName: 'LcTable',
    props: {
      columns: [{ dataIndex: 'name', title: '名称' }],
      rowActions: [],
    },
  });
  doc.root.children.insert(table);
  const toolbar = doc.createNode({
    componentName: 'LcToolbar',
    props: { actions: [] },
  });
  doc.root.children.insert(toolbar);
  window.__smokeNodes.table = table;
  window.__smokeNodes.toolbar = toolbar;
  return { tableId: table.id, toolbarId: toolbar.id, rootId: doc.root.id };
});

await page.evaluate((id) => {
  window.AliLowCodeEngine.project.currentDocument.selection.select(id);
}, listNodes.tableId);
await page.waitForTimeout(1200);

const tablePanel = await page.evaluate(
  () => document.querySelector('.lc-right-area')?.innerText ?? '',
);
console.log('table panel has 列配置:', tablePanel.includes('列配置'));

const columnsGroup = page
  .locator('.lc-right-area')
  .getByText('列配置', { exact: true })
  .first();
await columnsGroup.click();
await page.waitForTimeout(600);
const addColumn = page
  .locator('.lc-right-area')
  .getByText('+ 添加列', { exact: true })
  .first();
if (await addColumn.count()) {
  await addColumn.click();
  await page.waitForTimeout(800);
}
console.log(
  'columns:',
  JSON.stringify(await page.evaluate(() => window.__smokeNodes.table.getPropValue('columns'))),
);

await page.evaluate((id) => {
  window.AliLowCodeEngine.project.currentDocument.selection.select(id);
}, listNodes.toolbarId);
await page.waitForTimeout(1200);
const toolbarPanel = await page.evaluate(
  () => document.querySelector('.lc-right-area')?.innerText ?? '',
);
console.log('toolbar panel has 操作按钮:', toolbarPanel.includes('操作按钮'));

await page.evaluate((id) => {
  window.AliLowCodeEngine.project.currentDocument.selection.select(id);
}, listNodes.rootId);
await page.waitForTimeout(1200);
const rootPanel = await page.evaluate(
  () => document.querySelector('.lc-right-area')?.innerText ?? '',
);
console.log(
  'root panel has 列表数据源/行操作:',
  rootPanel.includes('列表数据源') && rootPanel.includes('行操作'),
);

await page.screenshot({ path: '/tmp/lc-setters.png' });
console.log('errors:', JSON.stringify(logs.slice(0, 5), null, 2));
await browser.close();
