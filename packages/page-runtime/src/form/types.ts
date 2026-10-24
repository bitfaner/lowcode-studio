import type { LinkageRule, ValidationRule } from '@lc/schema';

/**
 * 表单控制器与具体控件之间的最小契约。
 * 控制器不依赖 Lit / DOM，便于单测与在别的渲染层复用。
 */
export interface FormFieldHandle {
  name: string;
  getValue(): unknown;
  setValue(value: unknown): void;
  setError(message: string | null): void;
  setHidden?(hidden: boolean): void;
  setDisabled?(disabled: boolean): void;
  setRequired?(required: boolean): void;
  setOptions?(options: FieldOption[]): void;
  /** 联动需要读取字段原始状态，用于规则不再命中时恢复 */
  isHidden?(): boolean;
  isDisabled?(): boolean;
  isRequired?(): boolean;
  getOptions?(): FieldOption[];
  validate(): Promise<string | null>;
  getRules?(): ValidationRule[];
}

export type LinkageTargetProperty = 'hidden' | 'disabled' | 'required' | 'options';

export interface FieldOption {
  label: string;
  value: string | number | boolean;
  disabled?: boolean;
}

export interface FormValues {
  [name: string]: unknown;
}

export interface ValidateResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface FormControllerOptions {
  initialValues?: FormValues;
  linkages?: LinkageRule[];
}

export interface ValuesChangeDetail {
  values: FormValues;
  source?: string;
}
