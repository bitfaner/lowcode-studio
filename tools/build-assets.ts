import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  materials,
  type MaterialMeta,
  type PropMeta,
} from '../packages/materials/src/meta.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = resolve(rootDir, 'apps/studio/public/assets/assets.json');

const MATERIALS_PACKAGE = 'lc-materials';
const MATERIALS_VERSION = '0.1.0';
const MATERIALS_LIBRARY = 'LcMaterials';
const MATERIALS_UMD_URL = '/vendor/lc-materials.umd.js';
const MATERIALS_SOURCE_DIRS = [
  resolve(rootDir, 'packages/materials/src'),
  resolve(rootDir, 'packages/materials-react/src'),
];

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listSourceFiles(path)));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(path);
  }
  return files.sort();
}

/**
 * 物料版本 = 包版本 + 源码内容哈希。
 * 发布记录会保存该值，便于追溯“这份 schema 由哪版物料渲染”。
 */
async function computeMaterialsVersion(): Promise<string> {
  const hash = createHash('sha256');
  for (const dir of MATERIALS_SOURCE_DIRS) {
    for (const file of await listSourceFiles(dir)) {
      hash.update(file.slice(rootDir.length));
      hash.update(await readFile(file));
    }
  }
  return `${MATERIALS_VERSION}+${hash.digest('hex').slice(0, 8)}`;
}

interface FieldConfig {
  name: string;
  title: string;
  setter?: string | Record<string, unknown>;
  defaultValue?: unknown;
  condition?: (props: Record<string, unknown>) => boolean;
}

function toFieldConfig(prop: PropMeta): FieldConfig {
  const field: FieldConfig = {
    name: prop.name,
    title: prop.title,
  };
  if (prop.setter) field.setter = prop.setter;
  if (prop.defaultValue !== undefined) field.defaultValue = prop.defaultValue;
  // JSON 无法序列化函数，condition 仅保留在运行时 metadata 中
  return field;
}

function toComponentDescription(meta: MaterialMeta) {
  return {
    componentName: meta.componentName,
    exportName: meta.componentName,
    package: MATERIALS_PACKAGE,
    version: MATERIALS_VERSION,
    devMode: 'proCode' as const,
    npm: {
      package: MATERIALS_PACKAGE,
      version: MATERIALS_VERSION,
      exportName: meta.componentName,
      destructuring: true,
      subName: '',
    },
    title: meta.title,
    icon: meta.icon,
    keywords: [meta.componentName, meta.tagName],
    group: meta.group,
    category: meta.category ?? meta.group,
    configure: {
      props: meta.props.map(toFieldConfig),
      supports: {
        style: true,
        condition: true,
        loop: false,
        events: (meta.events ?? []).map((event) => ({
          name: event.name,
          description: event.title,
        })),
      },
      component: {
        isContainer: meta.isContainer ?? false,
      },
    },
    snippets: meta.snippets,
  };
}

async function main(): Promise<void> {
  const groupList = Array.from(new Set(materials.map((meta) => meta.group)));
  const materialsVersion = await computeMaterialsVersion();

  const assets = {
    version: '1.0.0',
    packages: [
      {
        // 模拟器 iframe 需要 Next（react-simulator-renderer 依赖 Menu/Icon/ConfigProvider）
        package: '@alifd/next',
        version: '1.24.18',
        library: 'Next',
        urls: ['/vendor/next.min.css', '/vendor/next.min.js'],
        editUrls: ['/vendor/next.min.css', '/vendor/next.min.js'],
      },
      {
        // 物料设计系统：antd 6 的 UMD 依赖 window.React / window.ReactDOM / window.dayjs
        package: 'dayjs',
        version: '1.11.13',
        library: 'dayjs',
        urls: ['/vendor/dayjs.min.js'],
        editUrls: ['/vendor/dayjs.min.js'],
      },
      {
        package: 'antd',
        version: '6.6.7',
        library: 'antd',
        urls: ['/vendor/antd.reset.css', '/vendor/antd.min.js'],
        editUrls: ['/vendor/antd.reset.css', '/vendor/antd.min.js'],
      },
      {
        package: MATERIALS_PACKAGE,
        version: materialsVersion,
        library: MATERIALS_LIBRARY,
        urls: [MATERIALS_UMD_URL],
        editUrls: [MATERIALS_UMD_URL],
      },
    ],
    components: materials.map(toComponentDescription),
    sort: {
      groupList,
      categoryList: groupList,
    },
  };

  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

  console.log(
    `[build-assets] 已生成 ${outFile}（${assets.components.length} 个物料，分组：${groupList.join(' / ')}）`,
  );
}

main().catch((error: unknown) => {
  console.error('[build-assets] 生成失败', error);
  process.exitCode = 1;
});
