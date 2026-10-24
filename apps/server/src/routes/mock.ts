import type { FastifyInstance } from 'fastify';
import { isRecord, notFound } from '../validate.js';

interface MockUser {
  id: number;
  name: string;
  phone: string;
  status: 'active' | 'disabled';
  role: 'admin' | 'member';
  createdAt: string;
}

/** 开发演示数据：重启后重置，避免测试相互污染 */
const users: MockUser[] = Array.from({ length: 23 }, (_, index) => {
  const id = index + 1;
  return {
    id,
    name: ['张伟', '李娜', '王芳', '刘洋', '陈晨', '杨帆'][index % 6] + (id > 6 ? id : ''),
    phone: `1380000${String(id).padStart(4, '0')}`,
    status: id % 4 === 0 ? 'disabled' : 'active',
    role: id % 7 === 0 ? 'admin' : 'member',
    createdAt: `2026-09-${String((index % 28) + 1).padStart(2, '0')} 10:00:00`,
  };
});
let nextId = users.length + 1;

export async function mockRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/mock/users', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const page = Math.max(Number(query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 10, 1), 100);
    const keyword = (query.keyword ?? '').trim();
    const status = query.status;

    let rows = users.filter((user) => {
      if (keyword && !user.name.includes(keyword) && !user.phone.includes(keyword)) return false;
      if (status && user.status !== status) return false;
      return true;
    });

    if (query.sortField === 'name' || query.sortField === 'createdAt') {
      const field = query.sortField;
      const direction = query.sortOrder === 'desc' ? -1 : 1;
      rows = [...rows].sort((a, b) => a[field].localeCompare(b[field]) * direction);
    }

    const total = rows.length;
    const start = (page - 1) * pageSize;
    return {
      data: {
        records: rows.slice(start, start + pageSize),
        total,
        page,
        pageSize,
      },
    };
  });

  app.post('/api/mock/users', async (request, reply) => {
    const body = isRecord(request.body) ? request.body : {};
    const user: MockUser = {
      id: nextId++,
      name: typeof body.name === 'string' && body.name ? body.name : `新用户${nextId}`,
      phone: typeof body.phone === 'string' ? body.phone : '',
      status: body.status === 'disabled' ? 'disabled' : 'active',
      role: body.role === 'admin' ? 'admin' : 'member',
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    users.unshift(user);
    return reply.code(201).send({ data: user });
  });

  app.put<{ Params: { id: string } }>('/api/mock/users/:id', async (request) => {
    const id = Number(request.params.id);
    const user = users.find((item) => item.id === id);
    if (!user) throw notFound('用户不存在');
    const body = isRecord(request.body) ? request.body : {};
    if (typeof body.name === 'string') user.name = body.name;
    if (typeof body.phone === 'string') user.phone = body.phone;
    if (body.status === 'active' || body.status === 'disabled') user.status = body.status;
    if (body.role === 'admin' || body.role === 'member') user.role = body.role;
    return { data: user };
  });

  app.delete<{ Params: { id: string } }>('/api/mock/users/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const index = users.findIndex((item) => item.id === id);
    if (index >= 0) users.splice(index, 1);
    return reply.code(204).send();
  });

  app.post('/api/mock/users/delete', async (request) => {
    const body = isRecord(request.body) ? request.body : {};
    const ids = new Set(
      (Array.isArray(body.ids) ? body.ids : [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value)),
    );
    for (let index = users.length - 1; index >= 0; index -= 1) {
      if (ids.has(users[index].id)) users.splice(index, 1);
    }
    return { ok: true, deleted: ids.size };
  });
}
