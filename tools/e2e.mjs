import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 浏览器端 E2E：串行运行 tools/ 下的冒烟脚本。
 * 需要先启动 dev:server / dev:studio / dev:runtime（或通过环境变量指向生产实例）。
 * 用法：pnpm e2e [脚本关键字...]（不带参数时运行全部）
 */
const toolsDir = dirname(fileURLToPath(import.meta.url));

const smokes = [
  ['smoke-studio', '设计器启动与基础渲染'],
  ['centers-smoke', '组件 / 设计 / 产物三中心'],
  ['drag-smoke', '拖拽物料到画布'],
  ['prop-smoke', '属性面板与选中态'],
  ['form-smoke', '表单校验与联动'],
  ['setter-smoke', '自定义设置器'],
  ['list-smoke', '列表设计态渲染'],
  ['list-live-smoke', '列表请求/查询/分页/排序/行删除'],
  ['save-publish-smoke', '保存 / 发布 / 运行时读取'],
  ['versions-smoke', '版本历史与回滚'],
  ['runtime-smoke', '运行时列表与抽屉表单'],
  ['dirty-smoke', '未保存修改确认'],
  ['autosave-smoke', '自动保存（结束后还原草稿）'],
  ['page-management-smoke', '新建 / 删除页面'],
];

const filters = process.argv.slice(2);
const selected = filters.length
  ? smokes.filter(([name]) => filters.some((filter) => name.includes(filter)))
  : smokes;

if (selected.length === 0) {
  console.error(`没有匹配的冒烟脚本：${filters.join(', ')}`);
  process.exit(1);
}

const services = {
  server: `${process.env.API_URL ?? 'http://127.0.0.1:3000'}/healthz`,
  studio: process.env.STUDIO_URL ?? 'http://127.0.0.1:5173/',
  runtime: process.env.RUNTIME_URL ?? 'http://127.0.0.1:5174/',
};

async function reachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}

let servicesOk = true;
for (const [name, url] of Object.entries(services)) {
  const ok = await reachable(url);
  console.log(`${ok ? '✓' : '✗'} ${name}: ${url}`);
  servicesOk = servicesOk && ok;
}

if (!servicesOk) {
  console.error(
    '\n服务未就绪。请先运行 pnpm dev:server、pnpm dev:studio、pnpm dev:runtime，或通过 API_URL / STUDIO_URL / RUNTIME_URL 指向已启动的实例。',
  );
  process.exit(1);
}

const results = [];
for (const [name, title] of selected) {
  const started = Date.now();
  console.log(`\n▶ ${name} — ${title}`);
  const result = spawnSync(process.execPath, [resolve(toolsDir, `${name}.mjs`)], {
    stdio: 'inherit',
    env: process.env,
    timeout: 240_000,
  });
  const duration = ((Date.now() - started) / 1000).toFixed(1);
  const pass = result.status === 0 && !result.error;
  results.push({ name, title, pass, duration, signal: result.signal ?? null });
  console.log(`${pass ? '✓' : '✗'} ${name} (${duration}s)`);
}

console.log('\n===== E2E 汇总 =====');
for (const item of results) {
  console.log(`${item.pass ? '✓' : '✗'} ${item.name} — ${item.title} (${item.duration}s)`);
}
const failed = results.filter((item) => !item.pass);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length === 0 ? 0 : 1);
