import type { FastifyInstance } from 'fastify';
import type { PageRuntimePayload, PageType } from '@lc/schema';
import type { PageRow } from '../db.js';
import {
  getAppBySlug,
  getLatestVersion,
  getPageById,
  getPageBySlug,
  getVersion,
  getVersionById,
} from '../db.js';
import { badRequest, notFound, parseJsonColumn } from '../validate.js';

interface RuntimeQuery {
  preview?: string;
  version?: string;
}

/**
 * 发布态读取 current_version；preview=1 读取草稿；version=n 读取指定快照。
 * 三种模式共用同一份 payload，runtime 只关心 schema。
 */
export function buildRuntimePayload(page: PageRow, query: RuntimeQuery): PageRuntimePayload {
  const preview = query.preview === '1' || query.preview === 'true';

  if (preview) {
    const schema = parseJsonColumn(page.draft_schema);
    if (!schema) throw notFound('该页面尚未保存草稿');
    return {
      schema: schema as PageRuntimePayload['schema'],
      pageId: page.id,
      pageName: page.name,
      pageType: page.type as PageType,
      version: null,
      preview: true,
    };
  }

  let versionRow;
  if (query.version !== undefined) {
    const version = Number(query.version);
    if (!Number.isInteger(version) || version <= 0) throw badRequest('版本号不合法');
    versionRow = getVersion(page.id, version);
    if (!versionRow) throw notFound(`版本 ${version} 不存在`);
  } else {
    versionRow = page.current_version_id
      ? getVersionById(page.current_version_id)
      : getLatestVersion(page.id);
    if (!versionRow) throw notFound('该页面尚未发布，请先在设计器发布');
  }

  return {
    schema: parseJsonColumn(versionRow.schema) as PageRuntimePayload['schema'],
    pageId: page.id,
    pageName: page.name,
    pageType: page.type as PageType,
    version: versionRow.version,
    preview: false,
    assetsVersion: versionRow.assets_version ?? undefined,
  };
}

export async function runtimeRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { appSlug: string; pageSlug: string }; Querystring: RuntimeQuery }>(
    '/api/runtime/:appSlug/:pageSlug',
    async (request) => {
      const appRow = getAppBySlug(request.params.appSlug);
      if (!appRow) throw notFound('应用不存在');
      const page = getPageBySlug(appRow.id, request.params.pageSlug);
      if (!page) throw notFound('页面不存在');
      return buildRuntimePayload(page, request.query);
    },
  );

  app.get<{ Params: { pageId: string }; Querystring: RuntimeQuery }>(
    '/api/runtime/pages/:pageId',
    async (request) => {
      const page = getPageById(request.params.pageId);
      if (!page) throw notFound('页面不存在');
      return buildRuntimePayload(page, request.query);
    },
  );
}
