import type { PageType, ProjectSchema } from '@lc/schema';
import { createDefaultProjectSchema } from './schema.js';

export interface PageMeta {
  id: string;
  appId: string;
  name: string;
  slug: string;
  type: PageType;
  updatedAt: string;
  currentVersion: number | null;
  hasDraft: boolean;
}

export interface PageDetail extends PageMeta {
  appSlug?: string;
  appName?: string;
  draftSchema: ProjectSchema | null;
}

export interface ArtifactMeta extends PageMeta {
  appName: string;
  appSlug: string;
  versionCount: number;
  publishedAt: string | null;
}

export interface PublishResult {
  version: number;
  versionId: string;
  publishedAt: string;
  assetsVersion: string | null;
  runtimeUrl: string;
}

export interface StudioState {
  pageId: string;
  page: PageDetail | null;
  pages: PageMeta[];
  error: string | null;
}

const DEFAULT_PAGE_ID = 'page_home';

function readPageId(): string {
  const fromQuery = new URLSearchParams(window.location.search).get('pageId');
  return fromQuery?.trim() || DEFAULT_PAGE_ID;
}

class StudioSession extends EventTarget {
  state: StudioState = { pageId: readPageId(), page: null, pages: [], error: null };

  update(patch: Partial<StudioState>): void {
    this.state = { ...this.state, ...patch };
    this.dispatchEvent(new Event('change'));
  }

  subscribe(listener: () => void): () => void {
    this.addEventListener('change', listener);
    return () => this.removeEventListener('change', listener);
  }
}

export const studioSession = new StudioSession();

/** 设计器 Token，与服务端 STUDIO_TOKEN 对应；未配置时留空 */
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('lc-studio-token');
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...authHeaders(),
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `请求失败（${response.status}）`;
    throw new Error(message);
  }
  return payload as T;
}

export function currentPageId(): string {
  return studioSession.state.pageId;
}

export async function fetchPageSnapshot(pageId: string): Promise<PageDetail> {
  const result = await request<{ page: PageDetail }>(
    `/api/pages/${encodeURIComponent(pageId)}`,
  );
  return result.page;
}

export async function fetchPage(pageId = currentPageId()): Promise<PageDetail> {
  const page = await fetchPageSnapshot(pageId);
  studioSession.update({ page, error: null });
  return page;
}

export async function fetchAppPages(appId: string): Promise<PageMeta[]> {
  const result = await request<{ pages: PageMeta[] }>(
    `/api/apps/${encodeURIComponent(appId)}/pages`,
  );
  studioSession.update({ pages: result.pages });
  return result.pages;
}

export async function fetchArtifacts(): Promise<ArtifactMeta[]> {
  const result = await request<{ artifacts: ArtifactMeta[] }>('/api/artifacts');
  return result.artifacts;
}

export interface CreatePageInput {
  name: string;
  slug: string;
  type: PageType;
}

export async function createPage(appId: string, input: CreatePageInput): Promise<PageDetail> {
  const result = await request<{ page: PageDetail }>(
    `/api/apps/${encodeURIComponent(appId)}/pages`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  await fetchAppPages(appId).catch(() => undefined);
  return result.page;
}

export async function deletePage(pageId: string): Promise<void> {
  await request<null>(`/api/pages/${encodeURIComponent(pageId)}`, { method: 'DELETE' });
}

export interface PageVersionMeta {
  id: string;
  version: number;
  assetsVersion: string | null;
  createdAt: string;
  current: boolean;
}

export async function fetchVersions(pageId: string): Promise<PageVersionMeta[]> {
  const result = await request<{ versions: PageVersionMeta[] }>(
    `/api/pages/${encodeURIComponent(pageId)}/versions`,
  );
  return result.versions;
}

export async function rollbackPage(pageId: string, version: number): Promise<PageDetail> {
  const result = await request<{ page: PageDetail }>(
    `/api/pages/${encodeURIComponent(pageId)}/rollback/${version}`,
    { method: 'POST' },
  );
  studioSession.update({ page: result.page, error: null });
  return result.page;
}

/**
 * 设计器启动时读取草稿；服务端不可用时退回空白 schema，
 * 保证 studio 仍能离线使用（保存/发布会给出错误提示）。
 */
export async function loadInitialSchema(): Promise<ProjectSchema> {
  const pageId = currentPageId();
  try {
    const page = await fetchPage(pageId);
    // 页面下拉用于切换同一应用下的其他页面，失败不影响设计器启动
    void fetchAppPages(page.appId).catch(() => undefined);
    return page.draftSchema ?? createDefaultProjectSchema(page.name, page.type);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    studioSession.update({ error: message });
    console.warn('[studio] 无法加载页面草稿，使用空白页面：', message);
    return createDefaultProjectSchema();
  }
}

export async function saveDraft(pageId: string, schema: ProjectSchema): Promise<PageDetail> {
  const result = await request<{ page: PageDetail }>(
    `/api/pages/${encodeURIComponent(pageId)}/draft`,
    { method: 'PUT', body: JSON.stringify({ schema }) },
  );
  studioSession.update({ page: result.page, error: null });
  return result.page;
}

async function publishSnapshot(
  pageId: string,
  schema: ProjectSchema,
): Promise<PublishResult> {
  return request<PublishResult>(`/api/pages/${encodeURIComponent(pageId)}/publish`, {
    method: 'POST',
    body: JSON.stringify({ schema, assetsVersion: await currentAssetsVersion() }),
  });
}

export async function publishPage(
  pageId: string,
  schema: ProjectSchema,
): Promise<PublishResult> {
  const result = await publishSnapshot(pageId, schema);
  if (pageId === currentPageId()) {
    const page = await fetchPageSnapshot(pageId);
    studioSession.update({ page: { ...page, currentVersion: result.version }, error: null });
  }
  return result;
}

/** 产物中心发布已保存草稿，不切换当前设计页面。 */
export async function publishDraft(pageId: string): Promise<PublishResult> {
  const page = await fetchPageSnapshot(pageId);
  if (!page.draftSchema) throw new Error('该页面尚未保存草稿，请先进入设计中心保存');
  return publishSnapshot(pageId, page.draftSchema);
}

/** 读取当前物料版本，随发布快照记录，便于追溯渲染所用物料 */
async function currentAssetsVersion(): Promise<string | undefined> {
  try {
    const response = await fetch('/assets/assets.json', { cache: 'no-store' });
    if (!response.ok) return undefined;
    const assets = (await response.json()) as {
      packages?: Array<{ package?: string; version?: string }>;
    };
    return assets.packages?.find((item) => item.package === 'lc-materials')?.version;
  } catch {
    return undefined;
  }
}

/** 开发态 runtime 独立端口，生产态由同一个服务托管 */
export function runtimeUrl(
  options: { pageId?: string; preview?: boolean; version?: number } = {},
): string {
  const dev = window.location.port === '5173';
  const base = dev
    ? `${window.location.protocol}//${window.location.hostname}:5174/`
    : '/runtime/';
  const url = new URL(base, window.location.origin);
  const pageId = options.pageId ?? currentPageId();
  if (dev) url.searchParams.set('pageId', pageId);
  else url.searchParams.set('page', pageId);
  if (options.preview) url.searchParams.set('preview', '1');
  if (options.version) url.searchParams.set('version', String(options.version));
  return url.toString();
}
