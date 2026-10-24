import * as React from 'react';
import { Form as AntForm } from 'antd';
import {
  FormController,
  PageController,
  type FieldOption,
  type FormFieldHandle,
  type FormSchemaLoader,
  type FormSchemaRenderer,
  type FormValues,
} from '@lc/page-runtime';
import type { ActionConfig, ValidationRule } from '@lc/schema';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s]+$/;

/** 表单 / 页面控制器通过 Context 下发，替代 Lit 时代的 closest('lc-form') 查找。 */
export const FormContext = React.createContext<FormController | null>(null);

/**
 * 抽屉表单的行数据回填通道。
 *
 * 运行时在渲染抽屉表单前用它包裹渲染器，LcForm 挂载时把这份值作为初始值。
 * 替代 Lit 时代「向 <lc-form> 元素写属性 / 调 controller」的 DOM 桥接。
 */
export const FormValuesContext = React.createContext<FormValues | undefined>(undefined);

/**
 * 抽屉表单能力通道（formLoader / formRenderer）。
 *
 * 这两个值是函数，无法写进 schema；由运行时通过 Context 注入，
 * 物料层只是消费者，不感知运行时实现。
 */
export interface FormBridge {
  formLoader?: FormSchemaLoader;
  formRenderer?: FormSchemaRenderer;
}
export const FormBridgeContext = React.createContext<FormBridge>({});

export interface PageHost {
  controller: PageController;
  runAction(action: ActionConfig, row?: unknown): void;
  /** 页面级行操作：表格未单独配置时使用（schema 中 rowActions 习惯配置在 Page 上） */
  rowActions?: ActionConfig[];
}
export const PageContext = React.createContext<PageHost | null>(null);

export interface FieldBaseProps {
  name?: string;
  label?: string;
  placeholder?: string;
  value?: unknown;
  required?: boolean;
  rules?: ValidationRule[];
  disabled?: boolean;
  hidden?: boolean;
  help?: string;
  error?: string;
  options?: FieldOption[];
  __designMode?: 'design' | 'live';
  onChange?: (detail: { name: string; value: unknown }) => void;
}

interface FieldSnapshot {
  value: unknown;
  required: boolean;
  rules: ValidationRule[];
  label: string;
  name: string;
  options: FieldOption[];
}

function isNumeric(value: unknown): boolean {
  return (
    typeof value === 'number' ||
    (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)))
  );
}

/** 与 Lit 版 LcField.validate() 完全一致的校验语义。 */
export async function validateFieldValue(snapshot: FieldSnapshot): Promise<string | null> {
  const { value, required, rules, label, name } = snapshot;
  const empty =
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);

  if (required && empty) return `${label || name}不能为空`;

  for (const rule of rules ?? []) {
    if (rule.required && empty) return rule.message ?? `${label || name}不能为空`;
    if (empty) continue;
    const text = Array.isArray(value) ? value.join('') : String(value);
    if (rule.min != null && isNumeric(value) && Number(value) < rule.min) {
      return rule.message ?? `不能小于 ${rule.min}`;
    }
    if (rule.max != null && isNumeric(value) && Number(value) > rule.max) {
      return rule.message ?? `不能大于 ${rule.max}`;
    }
    if (rule.len != null && text.length !== rule.len) return rule.message ?? `长度必须为 ${rule.len}`;
    if (rule.pattern && !new RegExp(rule.pattern).test(text)) return rule.message ?? '格式不正确';
    if (rule.type === 'email' && !EMAIL_RE.test(text)) return rule.message ?? '邮箱格式不正确';
    if (rule.type === 'url' && !URL_RE.test(text)) return rule.message ?? 'URL 格式不正确';
  }
  return null;
}

export interface FieldRuntime {
  value: unknown;
  error: string | null;
  disabled: boolean;
  hidden: boolean;
  required: boolean;
  options: FieldOption[];
  /** 用户交互引发的变更：写值 + 清错 + 通知控制器与引擎事件面板 */
  change: (next: unknown) => void;
  /** 失焦/提交前的即时校验 */
  revalidate: () => void;
}

/**
 * 把 antd 受控组件接入 FormController：注册 FormFieldHandle，
 * 并把控制器下发的值/禁用/必填/选项同步回本地渲染状态。
 */
export function useField(props: FieldBaseProps): FieldRuntime {
  const form = React.useContext(FormContext);
  const [value, setValueState] = React.useState<unknown>(props.value);
  const [error, setError] = React.useState<string | null>(null);
  const [disabled, setDisabled] = React.useState<boolean>(Boolean(props.disabled));
  const [hidden, setHidden] = React.useState<boolean>(Boolean(props.hidden));
  const [required, setRequired] = React.useState<boolean>(Boolean(props.required));
  const [options, setOptions] = React.useState<FieldOption[]>(props.options ?? []);

  const snapshot = React.useRef<FieldSnapshot>({
    value,
    required,
    rules: props.rules ?? [],
    label: props.label ?? '',
    name: props.name ?? '',
    options,
  });
  snapshot.current = {
    value,
    required,
    rules: props.rules ?? [],
    label: props.label ?? '',
    name: props.name ?? '',
    options,
  };

  const stateRef = React.useRef({ hidden, disabled });
  stateRef.current = { hidden, disabled };

  const handle = React.useMemo<FormFieldHandle>(
    () => ({
      name: props.name ?? '',
      getValue: () => snapshot.current.value,
      setValue: (next) => {
        setValueState(next);
        setError(null);
      },
      setError: (message) => setError(message ?? null),
      setHidden: (next) => setHidden(next),
      setDisabled: (next) => setDisabled(next),
      setRequired: (next) => setRequired(next),
      setOptions: (next) => setOptions(next),
      isHidden: () => stateRef.current.hidden,
      isDisabled: () => stateRef.current.disabled,
      isRequired: () => snapshot.current.required,
      getOptions: () => snapshot.current.options,
      getRules: () => snapshot.current.rules,
      validate: () => validateFieldValue(snapshot.current),
    }),
    // handle 必须稳定：内部一律通过 snapshot.current 读取最新值
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  React.useEffect(() => {
    if (!form) return undefined;
    handle.name = props.name ?? '';
    if (!handle.name) return undefined;
    form.register(handle);
    return () => {
      // 闭包捕获的是本次注册时的 name，避免改名后残留旧条目
      handle.name = props.name ?? '';
      form.unregister(handle);
    };
  }, [form, handle, props.name]);

  React.useEffect(() => {
    setValueState(props.value);
  }, [props.value]);
  React.useEffect(() => {
    setDisabled(Boolean(props.disabled));
  }, [props.disabled]);
  React.useEffect(() => {
    setHidden(Boolean(props.hidden));
  }, [props.hidden]);
  React.useEffect(() => {
    setRequired(Boolean(props.required));
  }, [props.required]);
  React.useEffect(() => {
    if (props.options) setOptions(props.options);
  }, [props.options]);

  const change = React.useCallback(
    (next: unknown) => {
      // 控制器在 handleFieldChange 里立刻执行联动，而 snapshot 只在渲染时刷新，
      // 因此这里先把新值写进快照，否则联动会读到上一次的值（慢一拍）。
      snapshot.current = { ...snapshot.current, value: next };
      setValueState(next);
      setError(null);
      const name = props.name ?? '';
      if (name) form?.handleFieldChange(name, next);
      props.onChange?.({ name, value: next });
    },
    [form, props.name, props.onChange],
  );

  const revalidate = React.useCallback(() => {
    void validateFieldValue(snapshot.current).then((message) => setError(message));
  }, []);

  return { value, error, disabled, hidden, required, options, change, revalidate };
}

/** 字段外壳：标签 / 必填星号 / 错误或帮助文案。 */
export function FieldShell(props: {
  label?: string;
  required?: boolean;
  hidden?: boolean;
  error?: string | null;
  help?: string;
  children: React.ReactNode;
}): React.ReactElement | null {
  if (props.hidden) return null;
  return (
    <AntForm.Item
      label={props.label || undefined}
      required={props.required}
      validateStatus={props.error ? 'error' : undefined}
      help={props.error ?? props.help}
      style={{ marginBottom: 16 }}
    >
      {props.children}
    </AntForm.Item>
  );
}
