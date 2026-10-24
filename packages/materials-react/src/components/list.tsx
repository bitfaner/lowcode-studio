import * as React from 'react';
import { Alert, Button, Drawer, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DataClient,
  PageController,
  PAGE_EVENTS,
  type FormDrawerContext,
  type FormSchemaLoader,
  type FormSchemaRenderer,
  type PageState,
} from '@lc/page-runtime';
import type { ActionConfig, ColumnConfig, DataSourceConfig } from '@lc/schema';
import { getByPath } from '@lc/shared';
import { FormBridgeContext, PageContext, type PageHost } from '../field.js';

function buildActionRequest(
  config: DataSourceConfig,
  row: unknown,
  selection: string[],
): DataSourceConfig {
  const rowData = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
  const defaults: Record<string, unknown> = {
    ...rowData,
    ...(selection.length ? { ids: selection } : {}),
  };
  if ((config.method ?? 'POST') === 'GET') {
    return { ...config, params: config.params ?? defaults };
  }
  return { ...config, body: config.body ?? defaults };
}

function formatDate(value: unknown): string {
  const text = String(value ?? '');
  return text.length > 16 ? text.slice(0, 16) : text;
}

/** 订阅 PageController 的变化，等价于 Lit 版监听 PAGE_EVENTS.change。 */
export function usePageState(controller: PageController | null): PageState | undefined {
  const [state, setState] = React.useState<PageState | undefined>(() => controller?.state);
  React.useEffect(() => {
    if (!controller) {
      setState(undefined);
      return undefined;
    }
    setState(controller.state);
    const onChange = () => setState({ ...controller.state });
    controller.addEventListener(PAGE_EVENTS.change, onChange);
    return () => controller.removeEventListener(PAGE_EVENTS.change, onChange);
  }, [controller]);
  return state;
}

export interface LcPageProps {
  title?: string;
  dataSource?: DataSourceConfig;
  rowKey?: string;
  pageSize?: number;
  formPageId?: string;
  rowActions?: ActionConfig[];
  formLoader?: FormSchemaLoader;
  formRenderer?: FormSchemaRenderer;
  __designMode?: 'design' | 'live';
  children?: React.ReactNode;
}

export function LcPage(props: LcPageProps): React.ReactElement {
  // 运行时通过 FormBridgeContext 注入抽屉表单能力；schema 里显式配置的 props 优先。
  const bridge = React.useContext(FormBridgeContext);
  const formLoader = props.formLoader ?? bridge.formLoader;
  const formRenderer = props.formRenderer ?? bridge.formRenderer;
  const controller = React.useMemo(() => new PageController(), []);
  const [message, setMessage] = React.useState('');
  const [messageType, setMessageType] = React.useState<'success' | 'error' | 'info'>('info');
  const [loading, setLoading] = React.useState(false);
  const [drawer, setDrawer] = React.useState({ open: false, title: '', mode: 'edit' as 'create' | 'edit' });
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const disposeRef = React.useRef<(() => void) | undefined>(undefined);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const configKey = React.useRef('');

  React.useEffect(() => {
    const key = JSON.stringify({
      dataSource: props.dataSource ?? null,
      rowKey: props.rowKey,
      pageSize: props.pageSize,
      designMode: props.__designMode ?? null,
    });
    if (key === configKey.current) return;
    configKey.current = key;
    controller.configure({
      dataSource: props.dataSource,
      rowKey: props.rowKey,
      pageSize: props.pageSize,
      designMode: props.__designMode === 'design',
    });
    void controller.load();
  }, [controller, props.dataSource, props.rowKey, props.pageSize, props.__designMode]);

  React.useEffect(() => () => {
    disposeRef.current?.();
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const showMessage = React.useCallback(
    (text: string, type: 'success' | 'error' | 'info') => {
      setMessage(text);
      setMessageType(type);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setMessage(''), 4000);
    },
    [],
  );

  const openForm = React.useCallback(
    async (action: ActionConfig, row?: unknown) => {
      const formPageId = action.formPageId || props.formPageId;
      if (!formPageId) {
        showMessage('未配置表单页', 'error');
        return;
      }
      const mode = action.mode ?? (row ? 'edit' : 'create');
      setDrawer({
        open: true,
        title: action.title || (mode === 'create' ? '新建' : '编辑'),
        mode,
      });
      if (!formLoader || !formRenderer) {
        showMessage('运行时未注入表单加载器或渲染器', 'error');
        return;
      }
      disposeRef.current?.();
      disposeRef.current = undefined;
      try {
        const schema = await formLoader(formPageId);
        if (!schema) {
          showMessage(`未找到表单页：${formPageId}`, 'error');
          return;
        }
        const container = containerRef.current;
        if (!container) return;
        container.replaceChildren();
        const context: FormDrawerContext = {
          mode,
          formPageId,
          row: (row && typeof row === 'object' ? row : undefined) as Record<string, unknown> | undefined,
          values: (row && typeof row === 'object' ? row : undefined) as Record<string, unknown> | undefined,
        };
        const dispose = formRenderer(schema, container, context);
        disposeRef.current = typeof dispose === 'function' ? dispose : undefined;
      } catch (error) {
        showMessage(error instanceof Error ? error.message : String(error), 'error');
      }
    },
    [formLoader, formRenderer, props.formPageId, showMessage],
  );

  const runAction = React.useCallback(
    async (action: ActionConfig, row?: unknown) => {
      if (props.__designMode === 'design') {
        showMessage(`设计态：${action.title}（不会发送请求）`, 'info');
        return;
      }
      const selection = controller.state.selection;
      if (action.requireSelection && selection.length === 0) {
        showMessage('请先选择数据', 'error');
        return;
      }
      if (action.confirm && !window.confirm(action.confirm)) return;

      if (action.request) {
        setLoading(true);
        try {
          const client = new DataClient();
          const config = buildActionRequest(action.request, row, selection);
          await client.request(config, {
            row: (row && typeof row === 'object' ? row : {}) as Record<string, unknown>,
            selection,
            ids: selection,
            page: controller.state.page,
            pageSize: controller.state.pageSize,
            query: controller.state.query,
          });
          showMessage(`${action.title}成功`, 'success');
          await controller.load();
        } catch (error) {
          showMessage(error instanceof Error ? error.message : String(error), 'error');
        } finally {
          setLoading(false);
        }
        return;
      }
      if (action.formPageId || props.formPageId) await openForm(action, row);
    },
    [controller, openForm, props.__designMode, props.formPageId, showMessage],
  );

  const pageRowActions = props.rowActions;
  const host = React.useMemo<PageHost>(
    () => ({
      controller,
      runAction: (a, row) => void runAction(a, row),
      rowActions: pageRowActions,
    }),
    [controller, runAction, pageRowActions],
  );

  const closeDrawer = () => {
    disposeRef.current?.();
    disposeRef.current = undefined;
    setDrawer((prev) => ({ ...prev, open: false }));
  };

  return (
    <PageContext.Provider value={host}>
      <div className="lc-page" style={{ padding: props.title ? 16 : 0, opacity: loading ? 0.85 : 1 }}>
        {props.title ? (
          <Typography.Title level={4} style={{ marginTop: 0 }}>
            {props.title}
          </Typography.Title>
        ) : null}
        {message ? (
          <div style={{ marginBottom: 12 }}>
            <Alert type={messageType} showIcon message={message} />
          </div>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{props.children}</div>
      </div>
      <Drawer
        title={drawer.title}
        open={drawer.open}
        width={560}
        onClose={closeDrawer}
        destroyOnHidden
        footer={<Button onClick={closeDrawer}>关闭</Button>}
      >
        <div ref={containerRef} />
      </Drawer>
    </PageContext.Provider>
  );
}

export interface LcToolbarProps {
  actions?: ActionConfig[];
}

export function LcToolbar(props: LcToolbarProps): React.ReactElement | null {
  const host = React.useContext(PageContext);
  const state = usePageState(host?.controller ?? null);
  const actions = props.actions ?? [];
  if (actions.length === 0) return null;
  const selectionCount = state?.selection.length ?? 0;
  return (
    <Space>
      {actions.map((action) => (
        <Button
          key={action.key}
          type={action.type === 'danger' ? 'default' : (action.type ?? 'default')}
          danger={action.type === 'danger'}
          disabled={Boolean(action.requireSelection && selectionCount === 0)}
          onClick={() => host?.runAction(action)}
        >
          {action.title}
        </Button>
      ))}
    </Space>
  );
}

export interface LcTableProps {
  columns?: ColumnConfig[];
  rowActions?: ActionConfig[];
  selection?: boolean;
  pagination?: boolean;
  pageSizeOptions?: number[];
  emptyText?: string;
  loading?: boolean;
}

function renderCell(value: unknown, column: ColumnConfig): React.ReactNode {
  if (value === undefined || value === null || value === '') {
    return <Typography.Text type="secondary">—</Typography.Text>;
  }
  switch (column.type) {
    case 'tag': {
      const meta = column.valueEnum?.[String(value)];
      return <Tag color={meta?.color}>{meta?.text ?? String(value)}</Tag>;
    }
    case 'date':
      return <span title={String(value)}>{formatDate(value)}</span>;
    case 'link':
      return <Typography.Link>{String(value)}</Typography.Link>;
    default:
      return <span title={String(value)}>{String(value)}</span>;
  }
}

export function LcTable(props: LcTableProps): React.ReactElement {
  const host = React.useContext(PageContext);
  const controller = host?.controller ?? null;
  const state = usePageState(controller);
  const columns: ColumnsType<Record<string, unknown>> = (props.columns ?? []).map((column) => ({
    title: column.title,
    dataIndex: column.dataIndex,
    key: column.dataIndex,
    width: column.width,
    ellipsis: column.ellipsis,
    sorter: column.sortable ? true : undefined,
    sortOrder:
      state?.sort?.field === column.dataIndex
        ? state.sort.order === 'asc'
          ? 'ascend'
          : 'descend'
        : null,
    render: (_: unknown, row: Record<string, unknown>) =>
      renderCell(getByPath(row, column.dataIndex), column),
  }));

  const rowActions = props.rowActions ?? host?.rowActions ?? [];
  if (rowActions.length) {
    columns.push({
      title: '操作',
      key: '__actions',
      width: 160,
      render: (_: unknown, row: Record<string, unknown>) => (
        <Space size={4}>
          {rowActions.map((action) => (
            <Button
              key={action.key}
              type="link"
              size="small"
              danger={action.type === 'danger'}
              onClick={() => host?.runAction(action, row)}
            >
              {action.title}
            </Button>
          ))}
        </Space>
      ),
    });
  }

  const rows = state?.rows ?? [];
  const busy = Boolean(props.loading || state?.loading);

  return (
    <div>
      {state?.error ? (
        <Alert type="error" showIcon message={state.error} style={{ marginBottom: 12 }} />
      ) : null}
      <Table<Record<string, unknown>>
        size="middle"
        columns={columns}
        dataSource={rows as Record<string, unknown>[]}
        rowKey={(row, index) => controller?.getRowKey(row, index ?? 0) ?? String(index)}
        loading={busy}
        locale={{ emptyText: busy ? '加载中…' : props.emptyText ?? '暂无数据' }}
        rowSelection={
          props.selection
            ? {
                selectedRowKeys: state?.selection ?? [],
                onChange: (keys) => controller?.setSelection(keys.map(String)),
              }
            : undefined
        }
        pagination={
          props.pagination === false
            ? false
            : {
                current: state?.page ?? 1,
                pageSize: state?.pageSize ?? 10,
                total: state?.total ?? 0,
                showSizeChanger: true,
                pageSizeOptions: (props.pageSizeOptions ?? [10, 20, 50]).map(String),
                showTotal: (total) => `共 ${total} 条`,
                onChange: (page, pageSize) => {
                  if (!controller) return;
                  if (pageSize !== state?.pageSize) void controller.setPageSize(pageSize);
                  else void controller.setPage(page);
                },
              }
        }
        onChange={(_pagination, _filters, sorter) => {
          if (!controller) return;
          const single = Array.isArray(sorter) ? sorter[0] : sorter;
          const field = String(single?.field ?? '');
          if (!field) return;
          if (!single?.order) void controller.setSort(undefined);
          else void controller.setSort({ field, order: single.order === 'ascend' ? 'asc' : 'desc' });
        }}
      />
    </div>
  );
}

export interface LcFormDrawerProps {
  open?: boolean;
  title?: string;
  width?: number;
  children?: React.ReactNode;
  onClose?: () => void;
}

export function LcFormDrawer(props: LcFormDrawerProps): React.ReactElement {
  return (
    <Drawer
      title={props.title}
      open={Boolean(props.open)}
      width={props.width ?? 560}
      onClose={props.onClose}
      footer={<Button onClick={props.onClose}>关闭</Button>}
    >
      {props.children}
    </Drawer>
  );
}

export const LIST_COMPONENTS = { LcPage, LcToolbar, LcTable, LcFormDrawer } as const;
