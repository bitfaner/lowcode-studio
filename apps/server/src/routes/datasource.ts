import { lookup } from 'node:dns/promises';
import type { FastifyInstance } from 'fastify';
import type { DatasourceRow } from '../db.js';
import { getDb } from '../db.js';
import { config } from '../config.js';
import { HttpError, badRequest, isRecord, notFound } from '../validate.js';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']);

interface ProxyBody {
  datasourceId?: string;
  url?: string;
  method?: string;
  params?: Record<string, unknown>;
  body?: Record<string, unknown>;
  timeout?: number;
}

interface DatasourceConfig {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  allowedHosts?: string[];
}

/** 阻止代理被用于探测内网 / 云元数据地址 */
function isPrivateAddress(ip: string): boolean {
  if (ip.includes(':')) {
    const value = ip.toLowerCase();
    if (value === '::1' || value === '::') return true;
    if (value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function hostAllowed(host: string, allowed: string[] | undefined): boolean {
  if (!allowed || allowed.length === 0) return true;
  return allowed.some((pattern) => {
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1);
      return host.endsWith(suffix) && host.length > suffix.length;
    }
    return host === pattern;
  });
}

async function assertSafeTarget(url: URL, extraAllowed: string[] | undefined): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw badRequest('数据源地址必须是 http/https');
  }

  // 平台自身的 mock 数据，允许走本机且绕过内网校验
  if (url.pathname.startsWith('/api/mock/')) return;

  const host = url.hostname.toLowerCase();
  if (!hostAllowed(host, config.datasourceAllowedHosts)) {
    throw new HttpError(403, `数据源域名 ${host} 不在全局白名单内`);
  }
  if (!hostAllowed(host, extraAllowed)) {
    throw new HttpError(403, `数据源域名 ${host} 不在数据源白名单内`);
  }
  if (config.allowPrivateDatasource) return;

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new HttpError(403, '数据源地址不能指向本机或内网域名');
  }

  const addresses = await lookup(host, { all: true }).catch(() => {
    throw new HttpError(502, `数据源域名解析失败：${host}`);
  });
  if (addresses.some((item) => isPrivateAddress(item.address))) {
    throw new HttpError(403, '数据源地址不能指向内网地址');
  }
}

function buildTargetUrl(base: string, params: Record<string, unknown> | undefined): URL {
  let target: URL;
  if (base.startsWith('/')) {
    target = new URL(base, `http://127.0.0.1:${config.port}`);
  } else {
    target = new URL(base);
  }
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      value.forEach((item) => target.searchParams.append(key, String(item)));
    } else if (typeof value === 'object') {
      target.searchParams.append(key, JSON.stringify(value));
    } else {
      target.searchParams.append(key, String(value));
    }
  }
  return target;
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new HttpError(413, '数据源响应超出大小限制');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export async function datasourceRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/datasource/proxy', async (request, reply) => {
    const body = (isRecord(request.body) ? request.body : {}) as ProxyBody;

    const datasourceId = typeof body.datasourceId === 'string' ? body.datasourceId : undefined;
    const dsRow = datasourceId
      ? (getDb().prepare('SELECT * FROM datasources WHERE id = ?').get(datasourceId) as
          | DatasourceRow
          | undefined)
      : undefined;
    if (datasourceId && !dsRow) throw notFound('数据源不存在');

    let dsConfig: DatasourceConfig = {};
    if (dsRow) {
      try {
        dsConfig = JSON.parse(dsRow.config) as DatasourceConfig;
      } catch {
        throw new HttpError(500, '数据源配置损坏');
      }
    }

    const base = dsConfig.url ?? body.url;
    if (typeof base !== 'string' || !base.trim()) throw badRequest('缺少数据源地址');

    const method = (dsConfig.method ?? body.method ?? 'GET').toUpperCase();
    if (!ALLOWED_METHODS.has(method)) throw badRequest(`不支持的请求方法：${method}`);

    const target = buildTargetUrl(base.trim(), isRecord(body.params) ? body.params : undefined);
    await assertSafeTarget(target, dsConfig.allowedHosts);

    const timeout = Math.min(Math.max(Number(body.timeout) || 15000, 1000), 60000);
    const headers: Record<string, string> = {
      accept: 'application/json, text/plain, */*',
      ...(dsConfig.headers ?? {}),
    };

    const payload = isRecord(body.body) ? body.body : undefined;
    let requestBody: string | undefined;
    if (method !== 'GET' && method !== 'HEAD' && payload) {
      requestBody = JSON.stringify(payload);
      headers['content-type'] ??= 'application/json';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    let upstream: Response;
    try {
      upstream = await fetch(target, {
        method,
        headers,
        body: requestBody,
        redirect: 'error',
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new HttpError(504, '数据源请求超时');
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpError(502, `数据源请求失败：${message}`);
    } finally {
      clearTimeout(timer);
    }

    const text = await readLimited(upstream, config.datasourceMaxBytes);
    reply.code(upstream.status).header('content-type', 'application/json; charset=utf-8');

    if (!text.trim()) return reply.send({});
    try {
      return reply.send(JSON.parse(text));
    } catch {
      return reply.send({ raw: text, upstreamContentType: upstream.headers.get('content-type') });
    }
  });
}
