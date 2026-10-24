import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

const tempDir = mkdtempSync(join(tmpdir(), 'lc-server-test-'));
const port = 20000 + Math.floor(Math.random() * 20000);

process.env.DB_FILE = join(tempDir, 'test.db');
process.env.STUDIO_TOKEN = 'test-token';
process.env.PORT = String(port);
process.env.STUDIO_DIR = join(tempDir, 'missing-studio');
process.env.RUNTIME_DIR = join(tempDir, 'missing-runtime');

const { buildServer } = await import('./app.js');
const { closeDb } = await import('./db.js');

let app: FastifyInstance;
const auth = { authorization: 'Bearer test-token' };

const schemaWithTitle = (title: string) => ({
  version: '1.0.0',
  componentsTree: [
    {
      componentName: 'Page',
      props: { title },
      children: [],
    },
  ],
});

beforeAll(async () => {
  app = await buildServer({ logger: false });
  await app.listen({ host: '127.0.0.1', port });
});

afterAll(async () => {
  await app.close();
  closeDb();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('seed data', () => {
  it('creates the demo app and home page', async () => {
    const apps = await app.inject({ method: 'GET', url: '/api/apps' });
    expect(apps.statusCode).toBe(200);
    expect(apps.json().apps).toEqual(
      expect.arrayContaining([expect.objectContaining({ slug: 'demo' })]),
    );

    const page = await app.inject({ method: 'GET', url: '/api/pages/page_home' });
    expect(page.statusCode).toBe(200);
    expect(page.json().page).toMatchObject({ name: '首页', slug: 'home', type: 'list' });
  });
});

describe('artifact center API', () => {
  it('aggregates page draft and publish state for the artifact center', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/artifacts' });
    expect(response.statusCode).toBe(200);
    expect(response.json().artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'page_home',
          appName: '示例应用',
          appSlug: 'demo',
          hasDraft: false,
          currentVersion: null,
          versionCount: 0,
        }),
      ]),
    );
  });
});

describe('draft / version / runtime', () => {
  it('requires a token for writes', async () => {
    const unauthorized = await app.inject({
      method: 'PUT',
      url: '/api/pages/page_home/draft',
      payload: { schema: schemaWithTitle('未授权') },
    });
    expect(unauthorized.statusCode).toBe(401);
  });

  it('saves a draft without affecting the published snapshot', async () => {
    const draft = await app.inject({
      method: 'PUT',
      url: '/api/pages/page_home/draft',
      headers: auth,
      payload: { schema: schemaWithTitle('草稿标题') },
    });
    expect(draft.statusCode).toBe(200);
    expect(draft.json().page.hasDraft).toBe(true);

    const preview = await app.inject({
      method: 'GET',
      url: '/api/runtime/pages/page_home?preview=1',
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().schema.componentsTree[0].props.title).toBe('草稿标题');
    expect(preview.json().preview).toBe(true);

    // 尚未发布，发布态读取应给出明确错误
    const runtime = await app.inject({ method: 'GET', url: '/api/runtime/demo/home' });
    expect(runtime.statusCode).toBe(404);
    expect(runtime.json().error).toContain('尚未发布');
  });

  it('publishes immutable versions and keeps runtime on the published snapshot', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/pages/page_home/publish',
      headers: auth,
      payload: {},
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().version).toBe(1);

    await app.inject({
      method: 'PUT',
      url: '/api/pages/page_home/draft',
      headers: auth,
      payload: { schema: schemaWithTitle('第二版草稿') },
    });

    const runtimeV1 = await app.inject({ method: 'GET', url: '/api/runtime/demo/home' });
    expect(runtimeV1.json().version).toBe(1);
    expect(runtimeV1.json().schema.componentsTree[0].props.title).toBe('草稿标题');

    const preview = await app.inject({
      method: 'GET',
      url: '/api/runtime/demo/home?preview=1',
    });
    expect(preview.json().schema.componentsTree[0].props.title).toBe('第二版草稿');

    const second = await app.inject({
      method: 'POST',
      url: '/api/pages/page_home/publish',
      headers: auth,
      payload: { assetsVersion: 'test-assets' },
    });
    expect(second.json().version).toBe(2);

    const runtimeV2 = await app.inject({
      method: 'GET',
      url: '/api/runtime/demo/home?version=2',
    });
    expect(runtimeV2.json().version).toBe(2);
    expect(runtimeV2.json().schema.componentsTree[0].props.title).toBe('第二版草稿');
    expect(runtimeV2.json().assetsVersion).toBe('test-assets');

    const versions = await app.inject({
      method: 'GET',
      url: '/api/pages/page_home/versions',
    });
    expect(versions.json().versions.map((item: { version: number }) => item.version)).toEqual([
      2, 1,
    ]);

    const rollback = await app.inject({
      method: 'POST',
      url: '/api/pages/page_home/rollback/1',
      headers: auth,
    });
    expect(rollback.statusCode).toBe(200);

    const runtimeAfterRollback = await app.inject({
      method: 'GET',
      url: '/api/runtime/demo/home',
    });
    expect(runtimeAfterRollback.json().version).toBe(1);
  });
});

describe('datasource proxy', () => {
  it('forwards platform mock data through the proxy', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/datasource/proxy',
      payload: {
        url: '/api/mock/users',
        method: 'GET',
        params: { page: 2, pageSize: 3, keyword: '张' },
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.page).toBe(2);
    expect(body.data.records).toHaveLength(1);
    expect(body.data.records[0].name).toContain('张');
  });

  it('blocks SSRF targets on loopback', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/datasource/proxy',
      payload: { url: `http://127.0.0.1:${port}/healthz`, method: 'GET' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toContain('内网');
  });

  it('propagates upstream error status', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/datasource/proxy',
      payload: {
        url: '/api/mock/users/999',
        method: 'PUT',
        body: { name: '不存在' },
      },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error).toContain('用户不存在');
  });
});
