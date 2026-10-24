import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.js';

declare module 'fastify' {
  interface FastifyRequest {
    isStudioUser?: boolean;
  }
}

function readBearer(request: FastifyRequest): string {
  const header = request.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

/** 设置 STUDIO_TOKEN 后，写接口必须携带 Authorization: Bearer <token> */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!config.studioToken) {
    request.isStudioUser = true;
    return;
  }
  if (readBearer(request) !== config.studioToken) {
    await reply.code(401).send({ error: '未授权的设计器操作' });
  }
}
