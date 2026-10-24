import type { LinkageAction, LinkageCondition, LinkageRule, LinkageWhen } from '@lc/schema';
import type {
  FieldOption,
  FormFieldHandle,
  FormValues,
  LinkageTargetProperty,
} from './types.js';

const ACTION_TARGET_PROPERTY: Partial<Record<LinkageAction['action'], LinkageTargetProperty>> = {
  show: 'hidden',
  hide: 'hidden',
  enable: 'disabled',
  disable: 'disabled',
  setRequired: 'required',
  setOptions: 'options',
};

/**
 * 找出所有被联动规则影响的字段与属性。
 * 控制器在每次执行联动前先按下这个集合恢复字段的原始状态，
 * 使「条件不再成立」时字段能自动还原，而不是永久停留在隐藏/禁用状态。
 */
export function collectLinkageTargets(
  rules: LinkageRule[] | undefined,
): Map<string, Set<LinkageTargetProperty>> {
  const targets = new Map<string, Set<LinkageTargetProperty>>();
  for (const rule of rules ?? []) {
    for (const action of rule.then ?? []) {
      const property = ACTION_TARGET_PROPERTY[action.action];
      if (!property || !action.target) continue;
      const set = targets.get(action.target) ?? new Set<LinkageTargetProperty>();
      set.add(property);
      targets.set(action.target, set);
    }
  }
  return targets;
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isNaN(value) ? undefined : value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/** 判断单个联动条件是否命中；只做结构化比较，不执行任意表达式 */
export function matchCondition(condition: LinkageCondition, values: FormValues): boolean {
  const actual = values[condition.field];
  const expected = condition.value;

  switch (condition.op) {
    case 'eq':
      return actual === expected || String(actual ?? '') === String(expected ?? '');
    case 'neq':
      return !(actual === expected || String(actual ?? '') === String(expected ?? ''));
    case 'in':
      return Array.isArray(expected) && expected.some((item) => item === actual);
    case 'notIn':
      return Array.isArray(expected) && !expected.some((item) => item === actual);
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const left = asNumber(actual);
      const right = asNumber(expected);
      if (left == null || right == null) return false;
      if (condition.op === 'gt') return left > right;
      if (condition.op === 'gte') return left >= right;
      if (condition.op === 'lt') return left < right;
      return left <= right;
    }
    case 'empty':
      return isEmpty(actual);
    case 'notEmpty':
      return !isEmpty(actual);
    default:
      return false;
  }
}

export function matchWhen(when: LinkageWhen, values: FormValues): boolean {
  if (!when || typeof when !== 'object') return false;
  if ('and' in when) {
    return (when.and ?? []).every((condition) => matchCondition(condition, values));
  }
  if ('or' in when) {
    return (when.or ?? []).some((condition) => matchCondition(condition, values));
  }
  return matchCondition(when, values);
}

function toOptions(value: unknown): FieldOption[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is FieldOption =>
      Boolean(item) && typeof item === 'object' && 'label' in item && 'value' in item,
  );
}

function applyAction(
  action: LinkageAction,
  getField: (name: string) => FormFieldHandle | undefined,
): boolean {
  const field = getField(action.target);
  if (!field) return false;

  switch (action.action) {
    case 'show':
      field.setHidden?.(false);
      return true;
    case 'hide':
      field.setHidden?.(true);
      return true;
    case 'enable':
      field.setDisabled?.(false);
      return true;
    case 'disable':
      field.setDisabled?.(true);
      return true;
    case 'setRequired':
      field.setRequired?.(Boolean(action.value));
      return true;
    case 'setValue':
      field.setValue(action.value);
      return true;
    case 'setOptions':
      field.setOptions?.(toOptions(action.value));
      return true;
    default:
      return false;
  }
}

/**
 * 执行联动规则。匹配规则按顺序执行，返回被修改的字段名。
 * 命中次数多时以最后一条规则为准（与低代码平台的常见预期一致）。
 */
export function applyLinkages(
  rules: LinkageRule[] | undefined,
  values: FormValues,
  getField: (name: string) => FormFieldHandle | undefined,
): string[] {
  if (!Array.isArray(rules) || rules.length === 0) return [];

  const touched = new Set<string>();
  for (const rule of rules) {
    if (!rule || !matchWhen(rule.when, values)) continue;
    for (const action of rule.then ?? []) {
      if (applyAction(action, getField)) {
        touched.add(action.target);
        // 后续规则应基于联动后的值继续判断
        if (action.action === 'setValue') values[action.target] = action.value;
      }
    }
  }
  return [...touched];
}
