import type { LinkageRule } from '@lc/schema';
import { applyLinkages, collectLinkageTargets } from './linkage.js';
import type {
  FieldOption,
  FormControllerOptions,
  FormFieldHandle,
  FormValues,
  LinkageTargetProperty,
  ValidateResult,
  ValuesChangeDetail,
} from './types.js';

export const FORM_EVENTS = {
  valuesChange: 'values-change',
  validate: 'validate',
  fieldRegister: 'field-register',
  fieldUnregister: 'field-unregister',
} as const;

/**
 * 表单状态与行为控制器（与渲染框架无关）。
 *
 * 设计原则：
 * - 字段值以字段实例为准，控制器只保存初始值 / 待填充值，避免两份状态互相覆盖；
 * - 联动规则在字段变更后统一执行；
 * - 校验、值收集、重置均可脱离 DOM 单测。
 */
export class FormController extends EventTarget {
  private readonly fields = new Map<string, FormFieldHandle>();
  private initialValues: FormValues;
  private pendingValues: FormValues = {};
  private linkages: LinkageRule[];
  private dirty = false;
  /** 联动字段的原始属性，用于条件不再命中时还原 */
  private readonly baselines = new Map<string, Partial<Record<LinkageTargetProperty, unknown>>>();
  private lastTargets = new Map<string, Set<LinkageTargetProperty>>();

  constructor(options: FormControllerOptions = {}) {
    super();
    this.initialValues = { ...(options.initialValues ?? {}) };
    this.linkages = options.linkages ?? [];
  }

  get isDirty(): boolean {
    return this.dirty;
  }

  getField(name: string): FormFieldHandle | undefined {
    return this.fields.get(name);
  }

  getFieldNames(): string[] {
    return [...this.fields.keys()];
  }

  register(field: FormFieldHandle): void {
    if (!field.name) return;
    this.fields.set(field.name, field);

    if (field.name in this.pendingValues) {
      field.setValue(this.pendingValues[field.name]);
      delete this.pendingValues[field.name];
    } else if (field.name in this.initialValues && field.getValue() === undefined) {
      field.setValue(this.initialValues[field.name]);
    }

    this.applyLinkages();
    this.emit(FORM_EVENTS.fieldRegister, { name: field.name });
    this.notify('register');
  }

  unregister(field: FormFieldHandle): void {
    if (this.fields.get(field.name) === field) {
      this.fields.delete(field.name);
      // 重新挂载的字段应重新采集原始状态，避免沿用旧基线
      this.baselines.delete(field.name);
      this.lastTargets.delete(field.name);
      this.emit(FORM_EVENTS.fieldUnregister, { name: field.name });
    }
  }

  /** 字段值变更由控件调用；随后执行联动并广播 */
  handleFieldChange(name: string, value: unknown): void {
    if (!name) return;
    this.dirty = true;
    this.applyLinkages();
    this.notify(`field:${name}`, value);
  }

  getValues(): FormValues {
    const values: FormValues = { ...this.initialValues, ...this.pendingValues };
    for (const [name, field] of this.fields) {
      values[name] = field.getValue();
    }
    return values;
  }

  setValues(values: FormValues): void {
    const rest: FormValues = {};
    for (const [name, value] of Object.entries(values ?? {})) {
      const field = this.fields.get(name);
      if (field) {
        field.setValue(value);
      } else {
        rest[name] = value;
      }
    }
    this.pendingValues = { ...this.pendingValues, ...rest };
    this.applyLinkages();
    this.notify('setValues');
  }

  setInitialValues(values: FormValues): void {
    this.initialValues = { ...(values ?? {}) };
    const merged: FormValues = {};
    for (const name of this.fields.keys()) {
      merged[name] = name in this.initialValues ? this.initialValues[name] : undefined;
    }
    this.setValues(merged);
    this.pendingValues = { ...this.initialValues };
    this.dirty = false;
    this.notify('initialValues');
  }

  setLinkages(linkages: LinkageRule[] | undefined): void {
    this.linkages = linkages ?? [];
    this.applyLinkages();
  }

  async validate(): Promise<ValidateResult> {
    const errors: Record<string, string> = {};
    for (const [name, field] of this.fields) {
      const message = await field.validate();
      field.setError(message);
      if (message) errors[name] = message;
    }
    const result: ValidateResult = { valid: Object.keys(errors).length === 0, errors };
    this.emit(FORM_EVENTS.validate, result);
    return result;
  }

  reset(): void {
    for (const [name, field] of this.fields) {
      field.setValue(this.initialValues[name]);
      field.setError(null);
    }
    this.pendingValues = { ...this.initialValues };
    this.dirty = false;
    this.applyLinkages();
    this.notify('reset');
  }

  applyLinkages(): void {
    const targets = collectLinkageTargets(this.linkages);

    // 规则或字段被移除后，恢复不再受控的字段属性
    for (const [name, properties] of this.lastTargets) {
      const field = this.fields.get(name);
      if (!field) continue;
      const next = targets.get(name);
      for (const property of properties) {
        if (!next?.has(property)) this.restoreProperty(name, field, property);
      }
    }

    // 每次执行前先恢复基线，命中的规则再覆盖，保证条件失效时自动还原
    for (const [name, properties] of targets) {
      const field = this.fields.get(name);
      if (!field) continue;
      this.captureBaseline(name, field, properties);
      for (const property of properties) this.restoreProperty(name, field, property);
    }
    this.lastTargets = targets;

    const values = this.getValues();
    applyLinkages(this.linkages, values, (name) => this.fields.get(name));
  }

  private captureBaseline(
    name: string,
    field: FormFieldHandle,
    properties: Set<LinkageTargetProperty>,
  ): void {
    let baseline = this.baselines.get(name);
    if (!baseline) {
      baseline = {};
      this.baselines.set(name, baseline);
    }
    for (const property of properties) {
      if (Object.prototype.hasOwnProperty.call(baseline, property)) continue;
      switch (property) {
        case 'hidden':
          if (field.isHidden) baseline.hidden = field.isHidden();
          break;
        case 'disabled':
          if (field.isDisabled) baseline.disabled = field.isDisabled();
          break;
        case 'required':
          if (field.isRequired) baseline.required = field.isRequired();
          break;
        case 'options':
          if (field.getOptions) baseline.options = field.getOptions();
          break;
      }
    }
  }

  private restoreProperty(
    name: string,
    field: FormFieldHandle,
    property: LinkageTargetProperty,
  ): void {
    const baseline = this.baselines.get(name);
    if (!baseline || !Object.prototype.hasOwnProperty.call(baseline, property)) return;
    const value = baseline[property];
    switch (property) {
      case 'hidden':
        field.setHidden?.(Boolean(value));
        break;
      case 'disabled':
        field.setDisabled?.(Boolean(value));
        break;
      case 'required':
        field.setRequired?.(Boolean(value));
        break;
      case 'options':
        field.setOptions?.(value as FieldOption[]);
        break;
    }
  }

  private notify(source: string, value?: unknown): void {
    const detail: ValuesChangeDetail = { values: this.getValues(), source };
    this.emit(FORM_EVENTS.valuesChange, detail);
    void value;
  }

  private emit<T>(type: string, detail: T): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
