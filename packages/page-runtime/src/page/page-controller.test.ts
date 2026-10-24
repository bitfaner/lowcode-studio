import { describe, expect, it, vi } from 'vitest';
import type { DataClient } from '../data-client.js';
import { PageController, PAGE_EVENTS } from './page-controller.js';

function createClient(list: (...args: never[]) => unknown) {
  return { list } as unknown as DataClient;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('PageController', () => {
  it('uses mock rows in design mode without touching the client', async () => {
    const list = vi.fn();
    const controller = new PageController({
      designMode: true,
      client: createClient(list as never),
    });

    await controller.load();

    expect(list).not.toHaveBeenCalled();
    expect(controller.state.rows).toHaveLength(6);
    expect(controller.state.total).toBe(6);
  });

  it('passes query, pagination and sort to the data client', async () => {
    const list = vi.fn(async () => ({ rows: [{ id: 1 }], total: 21 }));
    const controller = new PageController({
      dataSource: { url: '/api/users' },
      pageSize: 10,
      client: createClient(list as never),
    });

    controller.state.query = { keyword: '张' };
    await controller.load();

    expect(list).toHaveBeenCalledWith(
      { url: '/api/users' },
      { page: 1, pageSize: 10, query: { keyword: '张' }, sort: undefined },
    );
    expect(controller.state.rows).toEqual([{ id: 1 }]);
    expect(controller.state.total).toBe(21);
    expect(controller.state.loading).toBe(false);
  });

  it('resets to the first page and clears selection on new query', async () => {
    const list = vi.fn(async () => ({ rows: [{ id: 'a' }, { id: 'b' }], total: 2 }));
    const controller = new PageController({
      dataSource: { url: '/api/users' },
      pageSize: 10,
      client: createClient(list as never),
    });
    await controller.load();
    controller.setSelection(['a', 'b']);
    controller.state.page = 3;

    await controller.setQuery({ keyword: 'x' });

    expect(controller.state.page).toBe(1);
    expect(controller.state.selection).toEqual([]);
    expect(controller.state.query).toEqual({ keyword: 'x' });
  });

  it('resets to the first page when page size changes', async () => {
    const list = vi.fn(async () => ({ rows: [], total: 0 }));
    const controller = new PageController({
      dataSource: { url: '/api/users' },
      client: createClient(list as never),
    });
    controller.state.page = 4;

    await controller.setPageSize(20);

    expect(controller.state.page).toBe(1);
    expect(controller.state.pageSize).toBe(20);
  });

  it('cycles sort state asc -> desc -> none', async () => {
    const list = vi.fn(async () => ({ rows: [], total: 0 }));
    const controller = new PageController({
      dataSource: { url: '/api/users' },
      client: createClient(list as never),
    });

    expect(controller.toggleSort('name')).toEqual({ field: 'name', order: 'asc' });
    expect(controller.state.sort).toEqual({ field: 'name', order: 'asc' });
    expect(controller.toggleSort('name')).toEqual({ field: 'name', order: 'desc' });
    expect(controller.toggleSort('name')).toBeUndefined();
    expect(controller.state.sort).toBeUndefined();
  });

  it('keeps only the latest response when requests race', async () => {
    const first = deferred<{ rows: unknown[]; total: number }>();
    const second = deferred<{ rows: unknown[]; total: number }>();
    const list = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const controller = new PageController({
      dataSource: { url: '/api/users' },
      client: createClient(list as never),
    });

    const load1 = controller.load();
    const load2 = controller.load();

    second.resolve({ rows: [{ id: 2 }], total: 1 });
    await load2;
    first.resolve({ rows: [{ id: 1 }], total: 1 });
    await load1;

    expect(controller.state.rows).toEqual([{ id: 2 }]);
    expect(controller.state.loading).toBe(false);
  });

  it('prunes selection to rows that still exist', async () => {
    const list = vi.fn(async () => ({ rows: [{ id: 1 }, { id: 2 }], total: 2 }));
    const controller = new PageController({
      dataSource: { url: '/api/users' },
      client: createClient(list as never),
    });
    await controller.load();
    controller.setSelection(['1', '9']);
    expect(controller.getSelectedRows()).toEqual([{ id: 1 }]);

    list.mockResolvedValueOnce({ rows: [{ id: 2 }], total: 1 });
    await controller.load();
    expect(controller.state.selection).toEqual([]);
  });

  it('exposes errors and emits page:error', async () => {
    const list = vi.fn(async () => {
      throw new Error('网络错误');
    });
    const controller = new PageController({
      dataSource: { url: '/api/users' },
      client: createClient(list as never),
    });
    const handler = vi.fn();
    controller.addEventListener(PAGE_EVENTS.error, handler);

    await controller.load();

    expect(controller.state.error).toBe('网络错误');
    expect(controller.state.rows).toEqual([]);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
