/**
 * 平台对 lowcode-engine ProjectSchema 的扩展类型。
 * 业务配置全部集中在页面根节点的 props 中，方便设计器设置器编辑与运行时读取。
 */

export type PageType = 'form' | 'list';

export type JSExpression = { type: 'JSExpression'; value: string };
export type JSFunction = { type: 'JSFunction'; value: string };

export interface NodeSchema {
  componentName: string;
  id?: string;
  props?: Record<string, unknown>;
  children?: NodeSchema[];
  hidden?: boolean | JSExpression;
  condition?: unknown;
  loop?: unknown;
  style?: Record<string, string | number>;
  [key: string]: unknown;
}

export interface ComponentMapItem {
  componentName: string;
  package?: string;
  version?: string;
  exportName?: string;
  destructuring?: boolean;
  subName?: string;
}

export interface ProjectSchema {
  version?: string;
  componentsTree: NodeSchema[];
  componentsMap?: ComponentMapItem[];
  dataSource?: Record<string, unknown>;
  utils?: unknown[];
  constants?: Record<string, unknown>;
  i18n?: Record<string, unknown>;
  config?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* 校验与联动                                                          */
/* ------------------------------------------------------------------ */

export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  len?: number;
  pattern?: string;
  /** 内置格式校验 */
  type?: 'email' | 'url';
  message?: string;
}

export type LinkageOp =
  | 'eq'
  | 'neq'
  | 'in'
  | 'notIn'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'empty'
  | 'notEmpty';

export interface LinkageCondition {
  field: string;
  op: LinkageOp;
  value?: unknown;
}

export type LinkageWhen =
  | LinkageCondition
  | { and: LinkageCondition[] }
  | { or: LinkageCondition[] };

export type LinkageActionType =
  | 'show'
  | 'hide'
  | 'enable'
  | 'disable'
  | 'setValue'
  | 'setOptions'
  | 'setRequired';

export interface LinkageAction {
  target: string;
  action: LinkageActionType;
  value?: unknown;
}

export interface LinkageRule {
  when: LinkageWhen;
  then: LinkageAction[];
}

/* ------------------------------------------------------------------ */
/* 数据源                                                              */
/* ------------------------------------------------------------------ */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface DataSourceConfig {
  id?: string;
  type?: 'rest' | 'mock';
  /** 业务后端地址；走代理时可由服务端按 datasourceId 覆盖 */
  url?: string;
  method?: HttpMethod;
  params?: Record<string, unknown>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  response?: {
    rows?: string;
    total?: string;
    item?: string;
  };
  timeout?: number;
  /** 默认 true：请求发往平台代理，避免 CORS 并隐藏密钥 */
  proxy?: boolean;
  /** 代理模式下服务端登记的数据源 id */
  datasourceId?: string;
}

/* ------------------------------------------------------------------ */
/* 列表配置                                                            */
/* ------------------------------------------------------------------ */

export type ColumnValueType = 'text' | 'tag' | 'date' | 'link' | 'action';

export interface ColumnValueEnumItem {
  text: string;
  color?: 'success' | 'warning' | 'danger' | 'neutral' | 'primary';
}

export interface ColumnConfig {
  dataIndex: string;
  title: string;
  width?: number;
  type?: ColumnValueType;
  sortable?: boolean;
  ellipsis?: boolean;
  valueEnum?: Record<string, ColumnValueEnumItem>;
}

export interface ActionConfig {
  key: string;
  title: string;
  type?: 'primary' | 'default' | 'danger';
  /** 打开表单页（新增/编辑） */
  formPageId?: string;
  mode?: 'create' | 'edit';
  confirm?: string;
  requireSelection?: boolean;
  request?: DataSourceConfig;
}

export interface SuccessConfig {
  message?: string;
  action?: 'message' | 'back' | 'close' | 'reload' | 'redirect';
  redirectUrl?: string;
}

/* ------------------------------------------------------------------ */
/* 页面 props                                                          */
/* ------------------------------------------------------------------ */

export interface FormPageProps {
  pageType?: 'form';
  title?: string;
  layout?: 'horizontal' | 'vertical';
  labelWidth?: number;
  columns?: number;
  initialValues?: Record<string, unknown>;
  /** 详情/编辑模式加载数据的接口 */
  load?: DataSourceConfig;
  submit?: DataSourceConfig;
  success?: SuccessConfig;
  linkages?: LinkageRule[];
  [key: string]: unknown;
}

export interface ListPageProps {
  pageType: 'list';
  title?: string;
  dataSource?: DataSourceConfig;
  rowKey?: string;
  formPageId?: string;
  rowActions?: ActionConfig[];
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/* 运行时 API                                                          */
/* ------------------------------------------------------------------ */

export interface PageRuntimePayload {
  schema: ProjectSchema;
  pageId: string;
  pageName?: string;
  pageType?: PageType;
  version?: number | null;
  preview?: boolean;
  assetsVersion?: string;
}

export interface PublishResult {
  version: number;
  publishedAt: string;
}

export const SCHEMA_VERSION = 1;
