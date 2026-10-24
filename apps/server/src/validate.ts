export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, message);
}

export function notFound(message: string): HttpError {
  return new HttpError(404, message);
}

export function conflict(message: string): HttpError {
  return new HttpError(409, message);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requiredString(value: unknown, name: string, maxLength = 120): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest(`缺少 ${name}`);
  }
  if (value.length > maxLength) {
    throw badRequest(`${name} 过长`);
  }
  return value.trim();
}

export function optionalString(value: unknown, name: string, maxLength = 120): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredString(value, name, maxLength);
}

export function slugString(value: unknown, name: string): string {
  const slug = requiredString(value, name, 64);
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(slug)) {
    throw badRequest(`${name} 只能包含字母、数字、下划线和连字符`);
  }
  return slug;
}

export function pageType(value: unknown): 'form' | 'list' {
  return value === 'list' ? 'list' : 'form';
}

export function parseJsonColumn(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
