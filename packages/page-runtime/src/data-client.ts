import type { DataSourceConfig } from '@lc/schema';
import { getByPath, interpolateDeep } from '@lc/shared';

export interface BindContext {
  page?: number;
  pageSize?: number;
  query?: Record<string, unknown>;
  row?: Record<string, unknown>;
  sort?: { field: string; order: 'asc' | 'desc' };
  [key: string]: unknown;
}

export interface ListResult<T = unknown> {
  rows: T[];
  total: number;
  raw: unknown;
}

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

export interface DataClientOptions {
  /** 平台数据源代理地址 */
  proxyUrl?: string;
  /** 附加到每个代理请求上的应用标识 */
  appId?: string;
  fetcher?: typeof fetch;
}

export const DEFAULT_PROXY_URL = '/api/datasource/proxy';

/**
 * 低代码页面的统一数据访问层。
 * - 默认经服务端代理，避免 CORS 并隐藏密钥；
 * - 占位符只做路径取值，不执行代码；
 * - 响应映射使用点路径。
 */
export class DataClient {
  private readonly proxyUrl: string;
  private readonly appId?: string;
  private readonly fetcher: typeof fetch;

  constructor(options: DataClientOptions = {}) {
    this.proxyUrl = options.proxyUrl ?? DEFAULT_PROXY_URL;
    this.appId = options.appId;
    // 浏览器要求 fetch 以 window 为 this 调用，直接保存引用会触发 Illegal invocation
    this.fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
  }

  async request<T = unknown>(config: DataSourceConfig, ctx: BindContext = {}): Promise<T> {
    const method = config.method ?? 'GET';
    const params = interpolateDeep(config.params ?? {}, ctx) as Record<string, unknown>;
    const body = interpolateDeep(config.body ?? {}, ctx) as Record<string, unknown>;

    if (config.proxy === false) {
      return this.directRequest<T>(config, method, params, body);
    }

    const response = await this.fetcher(this.proxyUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.appId ? { 'x-app-id': this.appId } : {}),
        ...(config.headers ?? {}),
      },
      body: JSON.stringify({
        datasourceId: config.datasourceId ?? config.id,
        url: config.url,
        method,
        params,
        body,
        timeout: config.timeout,
      }),
    });

    if (!response.ok) {
      throw new RequestError(
        `数据源请求失败（${response.status}）`,
        response.status,
        await safeRead(response),
      );
    }

    return (await response.json()) as T;
  }

  async list<T = unknown>(
    config: DataSourceConfig,
    ctx: BindContext = {},
  ): Promise<ListResult<T>> {
    const raw = await this.request<unknown>(config, ctx);
    const rowsPath = config.response?.rows ?? 'data.records';
    const totalPath = config.response?.total ?? 'data.total';
    const rowsValue = getByPath(raw, rowsPath);
    const totalValue = getByPath(raw, totalPath);

    const rows = Array.isArray(rowsValue)
      ? (rowsValue as T[])
      : Array.isArray(raw)
        ? (raw as T[])
        : [];

    const total =
      typeof totalValue === 'number'
        ? totalValue
        : typeof totalValue === 'string'
          ? Number(totalValue) || rows.length
          : rows.length;

    return { rows, total, raw };
  }

  async item<T = unknown>(
    config: DataSourceConfig,
    ctx: BindContext = {},
  ): Promise<T | undefined> {
    const raw = await this.request<unknown>(config, ctx);
    const path = config.response?.item;
    return (path ? getByPath(raw, path) : raw) as T | undefined;
  }

  private async directRequest<T>(
    config: DataSourceConfig,
    method: string,
    params: Record<string, unknown>,
    body: Record<string, unknown>,
  ): Promise<T> {
    const url = buildUrl(config.url ?? '', method === 'GET' ? params : undefined);
    const controller = new AbortController();
    const timer = config.timeout ? setTimeout(() => controller.abort(), config.timeout) : undefined;

    try {
      const response = await this.fetcher(url, {
        method,
        headers: {
          ...(method === 'GET' ? {} : { 'content-type': 'application/json' }),
          ...(config.headers ?? {}),
        },
        body: method === 'GET' ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new RequestError(
          `请求失败（${response.status}）`,
          response.status,
          await safeRead(response),
        );
      }
      return (await response.json()) as T;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function buildUrl(base: string, params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) return base;
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null) return;
    query.append(key, String(value));
  });
  return `${base}${base.includes('?') ? '&' : '?'}${query.toString()}`;
}

async function safeRead(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    try {
      return await response.text();
    } catch {
      return undefined;
    }
  }
}
