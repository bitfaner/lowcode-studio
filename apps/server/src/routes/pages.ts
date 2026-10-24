import type { FastifyInstance } from 'fastify';
import type { AppRow, PageRow } from '../db.js';
import {
  getAppById,
  getAppBySlug,
  getDb,
  getLatestVersion,
  getPageById,
  getPageBySlug,
  getVersion,
  getVersionById,
  newId,
  now,
} from '../db.js';
import { requireAuth } from '../auth.js';
import {
  badRequest,
  conflict,
  isRecord,
  notFound,
  optionalString,
  pageType,
  parseJsonColumn,
  requiredString,
  slugString,
} from '../validate.js';

interface PageParams {
  pageId: string;
}

function appView(row: AppRow) {
  return { id: row.id, name: row.name, slug: row.slug, createdAt: row.created_at };
}

function pageMeta(row: PageRow) {
  const current = row.current_version_id ? getVersionById(row.current_version_id) : undefined;
  return {
    id: row.id,
    appId: row.app_id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    updatedAt: row.updated_at,
    currentVersion: current?.version ?? null,
    hasDraft: row.draft_schema !== null,
  };
}

function pageDetail(row: PageRow) {
  const app = getAppById(row.app_id);
  return {
    ...pageMeta(row),
    appSlug: app?.slug,
    appName: app?.name,
    draftSchema: parseJsonColumn(row.draft_schema),
  };
}

interface ArtifactRow extends PageRow {
  app_name: string;
  app_slug: string;
  version_count: number;
  published_at: string | null;
}

function artifactView(row: ArtifactRow) {
  return {
    ...pageMeta(row),
    appName: row.app_name,
    appSlug: row.app_slug,
    versionCount: Number(row.version_count),
    publishedAt: row.published_at,
  };
}

function assertSchema(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || !Array.isArray(value.componentsTree)) {
    throw badRequest('schema 必须包含 componentsTree 数组');
  }
  return value;
}

export async function pagesRoutes(app: FastifyInstance): Promise<void> {
  // 产物中心聚合所有应用下的页面，并带上草稿/发布状态与版本数量。
  app.get('/api/artifacts', async () => {
    const rows = getDb()
      .prepare(
        `SELECT p.*, a.name AS app_name, a.slug AS app_slug,
                COUNT(v.id) AS version_count, MAX(v.created_at) AS published_at
         FROM pages p
         JOIN apps a ON a.id = p.app_id
         LEFT JOIN page_versions v ON v.page_id = p.id
         GROUP BY p.id
         ORDER BY p.updated_at DESC`,
      )
      .all() as unknown as ArtifactRow[];
    return { artifacts: rows.map(artifactView) };
  });

  app.get('/api/apps', async () => {
    const rows = getDb()
      .prepare('SELECT * FROM apps ORDER BY created_at ASC')
      .all() as unknown as AppRow[];
    return { apps: rows.map(appView) };
  });

  app.post('/api/apps', { preHandler: requireAuth }, async (request, reply) => {
    const body = isRecord(request.body) ? request.body : {};
    const name = requiredString(body.name, 'name');
    const slug = slugString(body.slug, 'slug');
    if (getAppBySlug(slug)) throw conflict(`应用标识 ${slug} 已存在`);
    const row: AppRow = { id: newId('app'), name, slug, created_at: now() };
    getDb()
      .prepare('INSERT INTO apps (id, name, slug, created_at) VALUES (?, ?, ?, ?)')
      .run(row.id, row.name, row.slug, row.created_at);
    return reply.code(201).send({ app: appView(row) });
  });

  app.get<{ Params: { appId: string } }>('/api/apps/:appId/pages', async (request) => {
    const appRow =
      getAppById(request.params.appId) ?? getAppBySlug(request.params.appId);
    if (!appRow) throw notFound('应用不存在');
    const rows = getDb()
      .prepare('SELECT * FROM pages WHERE app_id = ? ORDER BY updated_at DESC')
      .all(appRow.id) as unknown as PageRow[];
    return { app: appView(appRow), pages: rows.map(pageMeta) };
  });

  app.post<{ Params: { appId: string } }>(
    '/api/apps/:appId/pages',
    { preHandler: requireAuth },
    async (request, reply) => {
      const appRow = getAppById(request.params.appId) ?? getAppBySlug(request.params.appId);
      if (!appRow) throw notFound('应用不存在');
      const body = isRecord(request.body) ? request.body : {};
      const name = requiredString(body.name, 'name');
      const slug = slugString(body.slug, 'slug');
      if (getPageBySlug(appRow.id, slug)) throw conflict(`页面标识 ${slug} 已存在`);
      const row: PageRow = {
        id: newId('page'),
        app_id: appRow.id,
        name,
        slug,
        type: pageType(body.type),
        draft_schema: null,
        current_version_id: null,
        updated_at: now(),
      };
      getDb()
        .prepare(
          `INSERT INTO pages (id, app_id, name, slug, type, draft_schema, current_version_id, updated_at)
           VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`,
        )
        .run(row.id, row.app_id, row.name, row.slug, row.type, row.updated_at);
      return reply.code(201).send({ page: pageDetail(row) });
    },
  );

  app.get<{ Params: PageParams }>('/api/pages/:pageId', async (request) => {
    const row = getPageById(request.params.pageId);
    if (!row) throw notFound('页面不存在');
    return { page: pageDetail(row) };
  });

  app.put<{ Params: PageParams }>(
    '/api/pages/:pageId/draft',
    { preHandler: requireAuth },
    async (request) => {
      const row = getPageById(request.params.pageId);
      if (!row) throw notFound('页面不存在');
      const body = isRecord(request.body) ? request.body : {};
      const schema = assertSchema(body.schema ?? body);
      const name = optionalString(body.name, 'name') ?? row.name;
      const slug = body.slug === undefined ? row.slug : slugString(body.slug, 'slug');
      const type = body.type === undefined ? row.type : pageType(body.type);

      const duplicate = getPageBySlug(row.app_id, slug);
      if (duplicate && duplicate.id !== row.id) throw conflict(`页面标识 ${slug} 已存在`);

      const updatedAt = now();
      getDb()
        .prepare(
          `UPDATE pages SET name = ?, slug = ?, type = ?, draft_schema = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(name, slug, type, JSON.stringify(schema), updatedAt, row.id);
      const updated = getPageById(row.id)!;
      return { page: pageDetail(updated) };
    },
  );

  app.get<{ Params: PageParams }>('/api/pages/:pageId/versions', async (request) => {
    const row = getPageById(request.params.pageId);
    if (!row) throw notFound('页面不存在');
    const rows = getDb()
      .prepare(
        'SELECT id, version, assets_version, created_at FROM page_versions WHERE page_id = ? ORDER BY version DESC',
      )
      .all(row.id) as Array<{
      id: string;
      version: number;
      assets_version: string | null;
      created_at: string;
    }>;
    return {
      versions: rows.map((item) => ({
        id: item.id,
        version: item.version,
        assetsVersion: item.assets_version,
        createdAt: item.created_at,
        current: item.id === row.current_version_id,
      })),
    };
  });

  app.get<{ Params: { pageId: string; version: string } }>(
    '/api/pages/:pageId/versions/:version',
    async (request) => {
      const row = getPageById(request.params.pageId);
      if (!row) throw notFound('页面不存在');
      const version = Number(request.params.version);
      if (!Number.isInteger(version)) throw badRequest('版本号不合法');
      const found = getVersion(row.id, version);
      if (!found) throw notFound('版本不存在');
      return {
        version: {
          id: found.id,
          version: found.version,
          assetsVersion: found.assets_version,
          createdAt: found.created_at,
          schema: parseJsonColumn(found.schema),
        },
      };
    },
  );

  app.post<{ Params: PageParams }>(
    '/api/pages/:pageId/publish',
    { preHandler: requireAuth },
    async (request, reply) => {
      const row = getPageById(request.params.pageId);
      if (!row) throw notFound('页面不存在');
      const body = isRecord(request.body) ? request.body : {};
      const schema = body.schema === undefined ? parseJsonColumn(row.draft_schema) : assertSchema(body.schema);
      if (!schema) throw badRequest('页面还没有可发布的草稿，请先保存');

      const assetsVersion = optionalString(body.assetsVersion, 'assetsVersion', 200) ?? null;
      const db = getDb();
      const createdAt = now();
      const versionId = newId('ver');

      // 在写锁内取最新版本号，避免并发发布得到相同的 version
      db.exec('BEGIN IMMEDIATE');
      let version = 0;
      try {
        const latest = getLatestVersion(row.id);
        version = (latest?.version ?? 0) + 1;
        if (body.schema !== undefined) {
          db.prepare(
            'UPDATE pages SET draft_schema = ?, updated_at = ? WHERE id = ?',
          ).run(JSON.stringify(schema), createdAt, row.id);
        }
        db.prepare(
          `INSERT INTO page_versions (id, page_id, version, schema, assets_version, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(versionId, row.id, version, JSON.stringify(schema), assetsVersion, createdAt);
        db.prepare('UPDATE pages SET current_version_id = ?, updated_at = ? WHERE id = ?').run(
          versionId,
          createdAt,
          row.id,
        );
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }

      return reply.code(201).send({
        version,
        versionId,
        publishedAt: createdAt,
        assetsVersion,
        runtimeUrl: `/runtime/?page=${row.id}`,
      });
    },
  );

  app.post<{ Params: { pageId: string; version: string } }>(
    '/api/pages/:pageId/rollback/:version',
    { preHandler: requireAuth },
    async (request) => {
      const row = getPageById(request.params.pageId);
      if (!row) throw notFound('页面不存在');
      const version = Number(request.params.version);
      const found = Number.isInteger(version) ? getVersion(row.id, version) : undefined;
      if (!found) throw notFound('版本不存在');
      getDb()
        .prepare('UPDATE pages SET current_version_id = ?, updated_at = ? WHERE id = ?')
        .run(found.id, now(), row.id);
      return { page: pageDetail(getPageById(row.id)!) };
    },
  );

  app.delete<{ Params: PageParams }>(
    '/api/pages/:pageId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const row = getPageById(request.params.pageId);
      if (!row) throw notFound('页面不存在');
      getDb().prepare('DELETE FROM pages WHERE id = ?').run(row.id);
      return reply.code(204).send();
    },
  );
}
