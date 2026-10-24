import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';

export interface AppRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface PageRow {
  id: string;
  app_id: string;
  name: string;
  slug: string;
  type: string;
  draft_schema: string | null;
  current_version_id: string | null;
  updated_at: string;
}

export interface VersionRow {
  id: string;
  page_id: string;
  version: number;
  schema: string;
  assets_version: string | null;
  created_at: string;
}

export interface DatasourceRow {
  id: string;
  app_id: string;
  name: string;
  config: string;
}

let database: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (database) return database;
  mkdirSync(dirname(config.dbFile), { recursive: true });
  const db = new DatabaseSync(config.dbFile);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  migrate(db);
  seed(db);
  database = db;
  return db;
}

export function closeDb(): void {
  database?.close();
  database = null;
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS apps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'form',
      draft_schema TEXT,
      current_version_id TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE (app_id, slug)
    );

    CREATE TABLE IF NOT EXISTS page_versions (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      schema TEXT NOT NULL,
      assets_version TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (page_id, version)
    );

    CREATE TABLE IF NOT EXISTS datasources (
      id TEXT PRIMARY KEY,
      app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      config TEXT NOT NULL
    );
  `);
}

function seed(db: DatabaseSync): void {
  const exists = db.prepare('SELECT id FROM apps WHERE slug = ?').get('demo');
  if (exists) return;

  const now = new Date().toISOString();
  db.prepare('INSERT INTO apps (id, name, slug, created_at) VALUES (?, ?, ?, ?)').run(
    'app_demo',
    '示例应用',
    'demo',
    now,
  );
  db.prepare(
    `INSERT INTO pages (id, app_id, name, slug, type, draft_schema, current_version_id, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`,
  ).run('page_home', 'app_demo', '首页', 'home', 'list', now);
}

export function now(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export function getAppById(id: string): AppRow | undefined {
  return getDb().prepare('SELECT * FROM apps WHERE id = ?').get(id) as AppRow | undefined;
}

export function getAppBySlug(slug: string): AppRow | undefined {
  return getDb().prepare('SELECT * FROM apps WHERE slug = ?').get(slug) as AppRow | undefined;
}

export function getPageById(id: string): PageRow | undefined {
  return getDb().prepare('SELECT * FROM pages WHERE id = ?').get(id) as PageRow | undefined;
}

export function getPageBySlug(appId: string, slug: string): PageRow | undefined {
  return getDb()
    .prepare('SELECT * FROM pages WHERE app_id = ? AND slug = ?')
    .get(appId, slug) as PageRow | undefined;
}

export function getVersion(pageId: string, version: number): VersionRow | undefined {
  return getDb()
    .prepare('SELECT * FROM page_versions WHERE page_id = ? AND version = ?')
    .get(pageId, version) as VersionRow | undefined;
}

export function getVersionById(id: string): VersionRow | undefined {
  return getDb()
    .prepare('SELECT * FROM page_versions WHERE id = ?')
    .get(id) as VersionRow | undefined;
}

export function getLatestVersion(pageId: string): VersionRow | undefined {
  return getDb()
    .prepare('SELECT * FROM page_versions WHERE page_id = ? ORDER BY version DESC LIMIT 1')
    .get(pageId) as VersionRow | undefined;
}
