import * as React from 'react';
import * as ReactDOM from 'react-dom';
import ReactRenderer from '@alilc/lowcode-react-renderer';
import type { ProjectSchema } from '@lc/schema';
import { components, FormBridgeContext, FormValuesContext } from '@lc/materials-react';
import type { FormDrawerContext } from '@lc/page-runtime';
import './main.css';

interface RuntimePayload {
  schema: ProjectSchema;
  pageId: string;
  pageName?: string;
  version: number | null;
  preview: boolean;
}

const rootEl = document.getElementById('root') as HTMLElement;

const ROOT_COMPONENTS = new Set(['Page', 'Block', 'Component']);

/** 提前拦截未知物料，避免渲染器只打印日志、页面白屏 */
function validateSchema(schema: ProjectSchema): void {
  const root = schema.componentsTree?.[0];
  if (!root) throw new Error('页面 schema 为空');
  if (!ROOT_COMPONENTS.has(root.componentName)) {
    throw new Error(
      `页面根组件必须是 Page/Block/Component，当前为 ${root.componentName || '空'}`,
    );
  }
  const visit = (node: NonNullable<ProjectSchema['componentsTree']>[number]): void => {
    if (!ROOT_COMPONENTS.has(node.componentName) && !(node.componentName in components)) {
      throw new Error(`未知物料：${node.componentName}`);
    }
    node.children?.forEach(visit);
  };
  visit(root);
}

function pageIdFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('pageId') ?? params.get('page') ?? 'page_home';
}

function isPreview(): boolean {
  return new URLSearchParams(window.location.search).get('preview') === '1';
}

async function fetchRuntime(
  pageId: string,
  options: { preview?: boolean; version?: string | null } = {},
): Promise<RuntimePayload> {
  const query = new URLSearchParams();
  if (options.preview) query.set('preview', '1');
  if (options.version) query.set('version', options.version);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await fetch(`/api/runtime/pages/${encodeURIComponent(pageId)}${suffix}`);
  const body = (await response.json().catch(() => null)) as
    | (RuntimePayload & { error?: string })
    | null;
  if (!response.ok) {
    throw new Error(body?.error || `页面加载失败（${response.status}）`);
  }
  return body as RuntimePayload;
}

/** 抽屉表单：与主页面同一套渲染器与物料，读取当前模式对应的版本 */
async function loadFormSchema(formPageId: string): Promise<ProjectSchema | undefined> {
  const payload = await fetchRuntime(formPageId, { preview: isPreview() });
  return payload.schema;
}

/**
 * 挂载抽屉表单：与主页面共用同一套渲染器与物料。
 *
 * 行数据通过 FormValuesContext 下发给 LcForm，由它写入 FormController 的初始值，
 * 不再依赖 Lit 时代「查 <lc-form> 元素并调 controller」的 DOM 桥接。
 */
function renderForm(
  schema: ProjectSchema,
  container: HTMLElement,
  context: FormDrawerContext,
): () => void {
  validateSchema(schema);
  const rootSchema = schema.componentsTree[0];

  ReactDOM.render(
    <ErrorBoundary>
      <FormValuesContext.Provider value={context.values}>
        <ReactRenderer schema={rootSchema as never} components={components as never} />
      </FormValuesContext.Provider>
    </ErrorBoundary>,
    container,
  );

  return () => ReactDOM.unmountComponentAtNode(container);
}

/**
 * 运行时提供、schema 无法配置的能力：抽屉表单的加载器与渲染器。
 * 通过 FormBridgeContext 下发给物料层的 LcPage（LcPage 内部读 Context，不读 DOM）。
 */
const formBridge = { formLoader: loadFormSchema, formRenderer: renderForm };

interface BoundaryState {
  error: Error | null;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren<unknown>, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[runtime] 渲染异常', error, info);
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return <RuntimeMessage title="页面渲染失败" message={this.state.error.message} />;
    }
    return this.props.children;
  }
}

function RuntimeMessage(props: {
  title: string;
  message: string;
  hint?: string;
}): React.ReactElement {
  return (
    <div className="lc-runtime__message" role="alert">
      <h1>{props.title}</h1>
      <p>{props.message}</p>
      {props.hint ? <p className="hint">{props.hint}</p> : null}
    </div>
  );
}

function renderError(title: string, error: unknown, hint?: string): void {
  const message = error instanceof Error ? error.message : String(error);
  ReactDOM.render(<RuntimeMessage title={title} message={message} hint={hint} />, rootEl);
}

function renderPreviewBadge(version: number | null): void {
  const badge = document.createElement('div');
  badge.className = 'lc-runtime__preview';
  badge.textContent = version ? `预览模式 · v${version}` : '预览模式 · 草稿';
  document.body.appendChild(badge);
}

async function boot(): Promise<void> {
  const pageId = pageIdFromUrl();
  const preview = isPreview();
  const version = new URLSearchParams(window.location.search).get('version');

  rootEl.innerHTML = '<div class="lc-runtime__loading">正在加载页面…</div>';

  try {
    const payload = await fetchRuntime(pageId, { preview, version });
    validateSchema(payload.schema);
    const rootSchema = payload.schema.componentsTree[0];

    document.title = `${payload.pageName ?? '页面'}${preview ? ' · 预览' : ''}`;
    rootEl.innerHTML = '';
    ReactDOM.render(
      <ErrorBoundary>
        <FormBridgeContext.Provider value={formBridge}>
          <ReactRenderer schema={rootSchema as never} components={components as never} />
        </FormBridgeContext.Provider>
      </ErrorBoundary>,
      rootEl,
    );

    if (preview) renderPreviewBadge(payload.version);
  } catch (error) {
    console.error('[runtime] 页面加载失败', error);
    renderError(
      '页面加载失败',
      error,
      '请确认页面已保存/发布，且平台服务已启动（pnpm dev:server）。',
    );
  }
}

void boot();
