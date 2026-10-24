import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { materials } from '../packages/materials/src/meta.js';

/**
 * 三方一致性校验：
 *   metadata（物料清单） ↔ React componentsMap ↔ assets.json
 * 任一处缺失都会导致“设计器能看到、运行时白屏”一类问题，因此构建期直接失败。
 *
 * 说明：物料实现已从 Lit 自定义元素迁移到 React + antd，
 * 这里改用 TypeScript AST 读取 `export const components = { ... }` 的属性名，
 * 不再依赖源码文本格式（`} as never;`、注释、换行都不再影响校验）。
 */
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetsFile = resolve(rootDir, 'apps/studio/public/assets/assets.json');
const reactIndex = resolve(rootDir, 'packages/materials-react/src/index.ts');

interface AssetComponent {
  componentName: string;
  keywords?: string[];
}

/** 剥掉 as / satisfies / 括号包装，拿到真正的初始化表达式 */
function unwrapExpression(node: ts.Expression | undefined): ts.Expression | undefined {
  let current: ts.Expression | undefined = node;
  while (current) {
    if (
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isTypeAssertionExpression(current)
    ) {
      current = current.expression;
      continue;
    }
    return current;
  }
  return undefined;
}

function readComponentsMap(source: string, fileName: string): {
  names: Set<string>;
  exported: boolean;
} {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = new Set<string>();
  let exported = false;

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const isExported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!isExported) continue;

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'components') continue;
      const initializer = unwrapExpression(declaration.initializer);
      if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
        throw new Error('materials-react 的 components 必须是对象字面量');
      }
      exported = true;
      for (const property of initializer.properties) {
        if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) {
          names.add(property.name.getText(sourceFile));
        } else if (ts.isSpreadAssignment(property)) {
          throw new Error('components 不支持展开语法，无法静态校验物料清单');
        }
      }
    }
  }

  if (!exported) {
    throw new Error('未在 materials-react/src/index.ts 找到 `export const components = { ... }`');
  }
  return { names, exported };
}

async function main(): Promise<void> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const metaNames = new Set(materials.map((meta) => meta.componentName));
  const reactNames = readComponentsMap(
    await readFile(reactIndex, 'utf8'),
    'packages/materials-react/src/index.ts',
  ).names;
  const assets = JSON.parse(await readFile(assetsFile, 'utf8')) as {
    components: AssetComponent[];
  };
  const assetNames = new Set(assets.components.map((item) => item.componentName));
  const assetByName = new Map(assets.components.map((item) => [item.componentName, item]));

  for (const meta of materials) {
    if (!reactNames.has(meta.componentName)) {
      errors.push(`metadata 中的 ${meta.componentName} 未在 materials-react components 中导出`);
    }
    if (!assetNames.has(meta.componentName)) {
      errors.push(`assets.json 缺少物料 ${meta.componentName}（请运行 pnpm build:assets）`);
      continue;
    }
    // tagName 已不是自定义元素，仅作为物料关键字（设计器搜索/识别）保留
    const keywords = assetByName.get(meta.componentName)?.keywords ?? [];
    if (meta.tagName && !keywords.includes(meta.tagName)) {
      errors.push(`assets.json 的 ${meta.componentName} 缺少关键字 ${meta.tagName}（请运行 pnpm build:assets）`);
    }
  }

  for (const name of reactNames) {
    if (!metaNames.has(name)) errors.push(`React 导出了未登记的物料 ${name}`);
  }
  for (const name of assetNames) {
    if (!metaNames.has(name)) warnings.push(`assets.json 存在未登记的物料 ${name}`);
  }

  const expected = new Set(materials.map((meta) => meta.componentName));
  if (assets.components.length !== expected.size) {
    warnings.push(`assets.json 物料数量 ${assets.components.length} 与 metadata ${expected.size} 不一致`);
  }

  console.log(
    `[parity] metadata ${metaNames.size} 个 · React ${reactNames.size} 个 · assets ${assetNames.size} 个`,
  );
  for (const warning of warnings) console.warn(`[parity] warn: ${warning}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`[parity] error: ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('[parity] 物料三方一致 ✅');
}

main().catch((error: unknown) => {
  console.error('[parity] 校验失败', error);
  process.exitCode = 1;
});
