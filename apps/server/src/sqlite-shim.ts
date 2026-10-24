/**
 * Vitest（Vite 5）的内置模块表不包含 Node 24 的 `node:sqlite`，
 * 测试环境下把该导入重定向至此文件，用 createRequire 交回 Node 原生加载。
 * 生产运行（tsx）不会用到此文件。
 */
import { createRequire } from 'node:module';
import type * as NodeSqlite from 'node:sqlite';

const require = createRequire(import.meta.url);
const sqlite = require('node:sqlite') as typeof NodeSqlite;

export const DatabaseSync = sqlite.DatabaseSync;
export type DatabaseSync = NodeSqlite.DatabaseSync;
