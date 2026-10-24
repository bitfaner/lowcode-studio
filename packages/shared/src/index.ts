export function getByPath(source: unknown, path: string): unknown {
  if (!path) return source;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, source);
}

export function setByPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let cursor: Record<string, unknown> = target;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
      return;
    }
    if (cursor[key] == null || typeof cursor[key] !== 'object') {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  });
}

/** 支持 {{page}}、{{query.keyword}} 形式的占位符，不做任何代码求值 */
export function interpolate(template: string, ctx: Record<string, unknown>): unknown {
  const single = /^\{\{\s*([\w.]+)\s*\}\}$/.exec(template);
  if (single) return getByPath(ctx, single[1]);

  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const value = getByPath(ctx, path);
    return value == null ? '' : String(value);
  });
}

export function interpolateDeep<T>(value: T, ctx: Record<string, unknown>): T {
  if (typeof value === 'string') {
    return interpolate(value, ctx) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolateDeep(item, ctx)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = interpolateDeep(item, ctx);
    }
    return out as T;
  }
  return value;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

export function debounce<T extends (...args: never[]) => void>(fn: T, wait = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wrapped = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => timer && clearTimeout(timer);
  return wrapped;
}

export const LC_EVENTS = {
  fieldChange: 'lc-field-change',
  formSubmit: 'lc-form-submit',
  pageStateChange: 'lc-page-state-change',
  pageAction: 'lc-page-action',
  rowAction: 'lc-row-action',
  querySubmit: 'lc-query-submit',
  queryReset: 'lc-query-reset',
  requestError: 'lc-request-error',
  submitSuccess: 'lc-submit-success',
  closeDrawer: 'lc-close-drawer',
} as const;
