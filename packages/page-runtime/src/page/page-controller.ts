import type { DataSourceConfig } from '@lc/schema';
import { DataClient, type BindContext } from '../data-client.js';

export interface SortState {
  field: string;
  order: 'asc' | 'desc';
}

export interface PageState {
  rows: unknown[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  selection: string[];
  query: Record<string, unknown>;
  sort?: SortState;
}

export interface PageControllerOptions {
  dataSource?: DataSourceConfig;
  rowKey?: string;
  page?: number;
  pageSize?: number;
  initialQuery?: Record<string, unknown>;
  /** 设计态不发请求，直接展示示例数据 */
  designMode?: boolean;
  mockRows?: unknown[];
  client?: DataClient;
}

export const PAGE_EVENTS = {
  change: 'change',
  error: 'error',
} as const;

const DEFAULT_ROW_KEY = 'id';

/**
 * 列表页状态与行为（与渲染框架无关）。
 *
 * - 查询、分页、排序、选择都收敛到一处，物料只负责展示与触发；
 * - 请求竞态由 requestSeq 保证，只接受最后一次响应；
 * - 设计态使用示例数据，绝不发起真实请求。
 */
export class PageController extends EventTarget {
  readonly state: PageState;

  private dataSource?: DataSourceConfig;
  private rowKeyName: string;
  private readonly client: DataClient;
  private designMode: boolean;
  private mockRows?: unknown[];
  private requestSeq = 0;

  constructor(options: PageControllerOptions = {}) {
    super();
    this.dataSource = options.dataSource;
    this.rowKeyName = options.rowKey || DEFAULT_ROW_KEY;
    this.client = options.client ?? new DataClient();
    this.designMode = Boolean(options.designMode);
    this.mockRows = options.mockRows;
    this.state = {
      rows: [],
      total: 0,
      page: Math.max(1, options.page ?? 1),
      pageSize: Math.max(1, options.pageSize ?? 10),
      loading: false,
      error: null,
      selection: [],
      query: { ...(options.initialQuery ?? {}) },
    };
  }

  get rowKey(): string {
    return this.rowKeyName;
  }

  getRowKey(row: unknown, index: number): string {
    if (row && typeof row === 'object') {
      const value = (row as Record<string, unknown>)[this.rowKeyName];
      if (value != null) return String(value);
    }
    return String(index);
  }

  setDataSource(dataSource: DataSourceConfig | undefined): void {
    this.dataSource = dataSource;
  }

  setRowKey(rowKey: string | undefined): void {
    this.rowKeyName = rowKey || DEFAULT_ROW_KEY;
  }

  setDesignMode(designMode: boolean, mockRows?: unknown[]): void {
    this.designMode = designMode;
    if (mockRows) this.mockRows = mockRows;
  }

  /**
   * 批量应用页面配置，不触发请求；修改完成后由调用方决定何时 load()。
   * 这样物料可以在属性写入后一次性同步，避免每写一个属性就发一次请求。
   */
  configure(options: {
    dataSource?: DataSourceConfig;
    rowKey?: string;
    pageSize?: number;
    designMode?: boolean;
  }): void {
    if ('dataSource' in options) this.dataSource = options.dataSource;
    if (options.rowKey) this.rowKeyName = options.rowKey;
    if (options.pageSize && options.pageSize > 0 && options.pageSize !== this.state.pageSize) {
      this.state.pageSize = Math.floor(options.pageSize);
      this.state.page = 1;
    }
    if (typeof options.designMode === 'boolean') this.designMode = options.designMode;
  }

  async load(): Promise<void> {
    if (this.designMode) {
      const rows = this.mockRows ?? buildMockRows();
      this.state.rows = rows;
      this.state.total = rows.length;
      this.state.loading = false;
      this.state.error = null;
      this.pruneSelection();
      this.emitChange('load');
      return;
    }

    if (!this.dataSource?.url && !this.dataSource?.datasourceId) {
      this.state.rows = [];
      this.state.total = 0;
      this.state.loading = false;
      this.state.error = null;
      this.emitChange('load');
      return;
    }

    const seq = ++this.requestSeq;
    this.state.loading = true;
    this.state.error = null;
    this.emitChange('loading');

    const ctx: BindContext = {
      page: this.state.page,
      pageSize: this.state.pageSize,
      query: this.state.query,
      sort: this.state.sort,
    };

    try {
      const result = await this.client.list(this.dataSource, ctx);
      if (seq !== this.requestSeq) return;
      this.state.rows = result.rows;
      this.state.total = result.total;
    } catch (error) {
      if (seq !== this.requestSeq) return;
      this.state.rows = [];
      this.state.total = 0;
      this.state.error = error instanceof Error ? error.message : String(error);
      this.dispatchEvent(new CustomEvent(PAGE_EVENTS.error, { detail: { error } }));
    } finally {
      if (seq === this.requestSeq) {
        this.state.loading = false;
        this.pruneSelection();
        this.emitChange('load');
      }
    }
  }

  setQuery(values: Record<string, unknown>): Promise<void> {
    this.state.query = { ...(values ?? {}) };
    this.state.page = 1;
    this.clearSelection();
    this.emitChange('query');
    return this.load();
  }

  resetQuery(): Promise<void> {
    return this.setQuery({});
  }

  setPage(page: number): Promise<void> {
    const next = Math.max(1, Math.floor(page || 1));
    if (next === this.state.page) return Promise.resolve();
    this.state.page = next;
    this.clearSelection();
    this.emitChange('page');
    return this.load();
  }

  setPageSize(pageSize: number): Promise<void> {
    const next = Math.max(1, Math.floor(pageSize || 1));
    if (next === this.state.pageSize) return Promise.resolve();
    this.state.pageSize = next;
    this.state.page = 1;
    this.clearSelection();
    this.emitChange('pageSize');
    return this.load();
  }

  setSort(sort: SortState | undefined): Promise<void> {
    this.state.sort = sort;
    this.state.page = 1;
    this.emitChange('sort');
    return this.load();
  }

  toggleSort(field: string): SortState | undefined {
    const current = this.state.sort;
    let next: SortState | undefined;
    if (!current || current.field !== field) next = { field, order: 'asc' };
    else if (current.order === 'asc') next = { field, order: 'desc' };
    else next = undefined;
    void this.setSort(next);
    return next;
  }

  setSelection(keys: string[]): void {
    const unique = [...new Set(keys)];
    if (
      unique.length === this.state.selection.length &&
      unique.every((key, index) => key === this.state.selection[index])
    ) {
      return;
    }
    this.state.selection = unique;
    this.emitChange('selection');
  }

  clearSelection(): void {
    if (this.state.selection.length === 0) return;
    this.state.selection = [];
    this.emitChange('selection');
  }

  getSelectedRows(): unknown[] {
    const selected = new Set(this.state.selection);
    return this.state.rows.filter((row, index) => selected.has(this.getRowKey(row, index)));
  }

  isSelected(row: unknown, index: number): boolean {
    return this.state.selection.includes(this.getRowKey(row, index));
  }

  /** 供外部直接注入数据（例如行操作后局部更新） */
  setRows(rows: unknown[], total = rows.length): void {
    this.state.rows = rows;
    this.state.total = total;
    this.pruneSelection();
    this.emitChange('setRows');
  }

  private pruneSelection(): void {
    if (this.state.selection.length === 0) return;
    const available = new Set(
      this.state.rows.map((row, index) => this.getRowKey(row, index)),
    );
    const next = this.state.selection.filter((key) => available.has(key));
    if (next.length !== this.state.selection.length) this.state.selection = next;
  }

  private emitChange(source: string): void {
    this.dispatchEvent(
      new CustomEvent(PAGE_EVENTS.change, { detail: { state: this.state, source } }),
    );
  }
}

function buildMockRows(): Record<string, unknown>[] {
  const statuses = ['active', 'disabled'];
  return Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    name: `示例数据 ${index + 1}`,
    status: statuses[index % statuses.length],
    createdAt: `2026-0${(index % 9) + 1}-1${(index % 9) + 1} 10:30:00`,
  }));
}
