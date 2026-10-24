import * as React from 'react';
import {
  Checkbox,
  DatePicker,
  Input,
  InputNumber,
  Radio,
  Select,
  Switch,
} from 'antd';
import dayjs from 'dayjs';
import type { FieldOption } from '@lc/page-runtime';
import { FieldShell, useField, type FieldBaseProps } from '../field.js';

type Size = 'small' | 'medium' | 'large';

function toAntSize(size?: Size): 'small' | 'middle' | 'large' {
  return size === 'medium' ? 'middle' : (size as 'small' | 'middle' | 'large') ?? 'middle';
}

export interface LcInputProps extends FieldBaseProps {
  maxlength?: number;
  clearable?: boolean;
  size?: Size;
}

export function LcInput(props: LcInputProps): React.ReactElement | null {
  const field = useField(props);
  return (
    <FieldShell
      label={props.label}
      required={field.required}
      hidden={field.hidden}
      error={field.error}
      help={props.help}
    >
      <Input
        id={props.name}
        name={props.name}
        value={field.value == null ? '' : String(field.value)}
        placeholder={props.placeholder}
        disabled={field.disabled}
        allowClear={props.clearable}
        size={toAntSize(props.size)}
        maxLength={props.maxlength}
        onChange={(event) => field.change(event.target.value)}
        onBlur={field.revalidate}
      />
    </FieldShell>
  );
}

export interface LcTextareaProps extends FieldBaseProps {
  rows?: number;
  maxlength?: number;
}

export function LcTextarea(props: LcTextareaProps): React.ReactElement | null {
  const field = useField(props);
  return (
    <FieldShell
      label={props.label}
      required={field.required}
      hidden={field.hidden}
      error={field.error}
      help={props.help}
    >
      <Input.TextArea
        id={props.name}
        name={props.name}
        value={field.value == null ? '' : String(field.value)}
        placeholder={props.placeholder}
        disabled={field.disabled}
        rows={props.rows ?? 3}
        maxLength={props.maxlength}
        onChange={(event) => field.change(event.target.value)}
        onBlur={field.revalidate}
      />
    </FieldShell>
  );
}

export interface LcNumberProps extends FieldBaseProps {
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
}

export function LcNumber(props: LcNumberProps): React.ReactElement | null {
  const field = useField(props);
  return (
    <FieldShell
      label={props.label}
      required={field.required}
      hidden={field.hidden}
      error={field.error}
      help={props.help}
    >
      <InputNumber
        id={props.name}
        name={props.name}
        style={{ width: '100%' }}
        value={field.value as number | undefined}
        placeholder={props.placeholder}
        disabled={field.disabled}
        min={props.min}
        max={props.max}
        step={props.step}
        precision={props.precision}
        onChange={(next) => field.change(next ?? undefined)}
        onBlur={field.revalidate}
      />
    </FieldShell>
  );
}

export interface LcSelectProps extends FieldBaseProps {
  multiple?: boolean;
  clearable?: boolean;
}

export function LcSelect(props: LcSelectProps): React.ReactElement | null {
  const field = useField(props);
  const options = field.options.map((option) => ({
    label: option.label,
    value: option.value,
    disabled: option.disabled,
  }));
  return (
    <FieldShell
      label={props.label}
      required={field.required}
      hidden={field.hidden}
      error={field.error}
      help={props.help}
    >
      <Select
        id={props.name}
        style={{ width: '100%' }}
        value={field.value as never}
        placeholder={props.placeholder}
        disabled={field.disabled}
        mode={props.multiple ? 'multiple' : undefined}
        allowClear={props.clearable}
        options={options}
        onChange={(next) => field.change(next)}
        onBlur={field.revalidate}
      />
    </FieldShell>
  );
}

export interface LcRadioGroupProps extends FieldBaseProps {}

export function LcRadioGroup(props: LcRadioGroupProps): React.ReactElement | null {
  const field = useField(props);
  return (
    <FieldShell
      label={props.label}
      required={field.required}
      hidden={field.hidden}
      error={field.error}
      help={props.help}
    >
      <Radio.Group
        id={props.name}
        value={field.value as never}
        disabled={field.disabled}
        onChange={(event) => field.change(event.target.value)}
      >
        {field.options.map((option) => (
          <Radio key={String(option.value)} value={option.value} disabled={option.disabled}>
            {option.label}
          </Radio>
        ))}
      </Radio.Group>
    </FieldShell>
  );
}

export interface LcCheckboxGroupProps extends FieldBaseProps {}

export function LcCheckboxGroup(props: LcCheckboxGroupProps): React.ReactElement | null {
  const field = useField(props);
  const selected = Array.isArray(field.value)
    ? (field.value as unknown[])
    : field.value == null || field.value === ''
      ? []
      : [field.value];
  return (
    <FieldShell
      label={props.label}
      required={field.required}
      hidden={field.hidden}
      error={field.error}
      help={props.help}
    >
      <Checkbox.Group
        value={selected as never}
        disabled={field.disabled}
        onChange={(next) => field.change(next)}
      >
        {field.options.map((option) => (
          <Checkbox key={String(option.value)} value={option.value} disabled={option.disabled}>
            {option.label}
          </Checkbox>
        ))}
      </Checkbox.Group>
    </FieldShell>
  );
}

export interface LcSwitchProps extends FieldBaseProps {
  activeText?: string;
  inactiveText?: string;
}

export function LcSwitch(props: LcSwitchProps): React.ReactElement | null {
  const field = useField(props);
  return (
    <FieldShell
      label={props.label}
      required={field.required}
      hidden={field.hidden}
      error={field.error}
      help={props.help}
    >
      <Switch
        id={props.name}
        checked={Boolean(field.value)}
        disabled={field.disabled}
        checkedChildren={props.activeText || undefined}
        unCheckedChildren={props.inactiveText || undefined}
        onChange={(next) => field.change(next)}
      />
    </FieldShell>
  );
}

export interface LcDateProps extends FieldBaseProps {
  min?: string;
  max?: string;
}

export function LcDate(props: LcDateProps): React.ReactElement | null {
  const field = useField(props);
  const text = field.value == null ? '' : String(field.value);
  return (
    <FieldShell
      label={props.label}
      required={field.required}
      hidden={field.hidden}
      error={field.error}
      help={props.help}
    >
      <DatePicker
        id={props.name}
        style={{ width: '100%' }}
        value={text ? dayjs(text) : null}
        placeholder={props.placeholder}
        disabled={field.disabled}
        minDate={props.min ? dayjs(props.min) : undefined}
        maxDate={props.max ? dayjs(props.max) : undefined}
        onChange={(next) => field.change(next ? next.format('YYYY-MM-DD') : '')}
      />
    </FieldShell>
  );
}

export interface LcDateRangeProps extends FieldBaseProps {}

export function LcDateRange(props: LcDateRangeProps): React.ReactElement | null {
  const field = useField(props);
  const [start = '', end = ''] = Array.isArray(field.value) ? (field.value as unknown[]) : [];
  const emit = (index: 0 | 1, next: string) => {
    const current = Array.isArray(field.value) ? [...(field.value as unknown[])] : ['', ''];
    current[index] = next;
    field.change([String(current[0] ?? ''), String(current[1] ?? '')]);
  };
  return (
    <FieldShell
      label={props.label}
      required={field.required}
      hidden={field.hidden}
      error={field.error}
      help={props.help}
    >
      <Input.Group compact>
        <DatePicker
          style={{ width: '45%' }}
          value={start ? dayjs(String(start)) : null}
          disabled={field.disabled}
          placeholder="开始日期"
          onChange={(next) => emit(0, next ? next.format('YYYY-MM-DD') : '')}
        />
        <span style={{ padding: '0 8px', lineHeight: '32px' }}>~</span>
        <DatePicker
          style={{ width: '45%' }}
          value={end ? dayjs(String(end)) : null}
          disabled={field.disabled}
          placeholder="结束日期"
          onChange={(next) => emit(1, next ? next.format('YYYY-MM-DD') : '')}
        />
      </Input.Group>
    </FieldShell>
  );
}

export const FIELD_COMPONENTS = {
  LcInput,
  LcTextarea,
  LcNumber,
  LcSelect,
  LcRadioGroup,
  LcCheckboxGroup,
  LcSwitch,
  LcDate,
  LcDateRange,
} as const;

export type { FieldOption };
