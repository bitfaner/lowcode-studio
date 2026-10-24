import { existsSync } from 'node:fs';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { HttpError } from './validate.js';
import { pagesRoutes } from './routes/pages.js';
import { runtimeRoutes } from './routes/runtime.js';
import { datasourceRoutes } from './routes/datasource.js';
import { mockRoutes } from './routes/mock.js';

export async function buildServer(options: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? true,
    bodyLimit: 2 * 1024 * 1024,
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status =
      error instanceof HttpError
        ? error.statusCode
        : typeof error.statusCode === 'number'
          ? error.statusCode
          : 500;
    if (status >= 500) request.log.error(error);
    return reply.code(status).send({ error: error.message || '服务器内部错误' });
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: '接口不存在' });
    }
    return reply.code(404).type('text/plain; charset=utf-8').send('Not Found');
  });

  app.get('/healthz', async () => ({
    ok: true,
    service: 'lc-server',
    time: new Date().toISOString(),
  }));

  await app.register(pagesRoutes);
  await app.register(runtimeRoutes);
  await app.register(datasourceRoutes);
  await app.register(mockRoutes);

  if (existsSync(config.runtimeDir)) {
    await app.register(fastifyStatic, {
      root: config.runtimeDir,
      prefix: '/runtime/',
      decorateReply: false,
      maxAge: '5m',
    });
  }

  if (existsSync(config.studioDir)) {
    await app.register(fastifyStatic, {
      root: config.studioDir,
      prefix: '/',
      decorateReply: false,
    });
  }

  return app;
}
