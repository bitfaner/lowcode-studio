import type { ProjectSchema } from '@lc/schema';

export interface FormDrawerContext {
  mode: 'create' | 'edit';
  formPageId?: string;
  row?: Record<string, unknown>;
  values?: Record<string, unknown>;
}

/**
 * 列表页只负责「什么时候打开表单」，表单 schema 的加载与渲染由应用层注入。
 * 这样物料包不依赖 React / 运行时渲染器，设计器与正式运行时可以各自实现。
 */
export type FormSchemaLoader = (
  formPageId: string,
) => Promise<ProjectSchema | undefined>;

export type FormSchemaRenderer = (
  schema: ProjectSchema,
  container: HTMLElement,
  context: FormDrawerContext,
) => void | (() => void);
