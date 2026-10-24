import type { DataSourceConfig } from '@lc/schema';
import type { FormValues } from './types.js';

/**
 * 把表单值并入提交配置：
 * - GET：字段值作为查询参数；
 * - 其它方法：未显式配置 body 时，直接把表单值作为请求体；
 * - 显式配置了 body/params 时保留原配置，由 DataClient 用 {{form.x}} / {{values.x}} 占位符求值。
 */
export function buildSubmitRequest(
  config: DataSourceConfig,
  values: FormValues,
): DataSourceConfig {
  const method = config.method ?? 'POST';
  if (method === 'GET') {
    return {
      ...config,
      params: { ...values, ...(config.params ?? {}) },
    };
  }

  const hasBody = config.body && Object.keys(config.body).length > 0;
  return {
    ...config,
    body: hasBody ? config.body : values,
  };
}

/** 表单提交时可用的插值上下文 */
export function buildSubmitContext(values: FormValues): Record<string, unknown> {
  return {
    form: values,
    values,
    ...values,
  };
}
