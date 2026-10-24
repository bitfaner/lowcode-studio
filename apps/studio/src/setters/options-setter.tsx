import * as React from 'react';
import {
  DangerButton,
  LinkButton,
  SmallInput,
  cardStyle,
  labelStyle,
  rowStyle,
  type SetterProps,
} from './common.js';

export interface SelectOption {
  label: string;
  value: string | number | boolean;
  disabled?: boolean;
}

export function OptionsSetter(props: SetterProps<SelectOption[]>) {
  const options = Array.isArray(props.value) ? props.value : [];

  const update = (index: number, patch: Partial<SelectOption>) => {
    props.onChange?.(options.map((option, i) => (i === index ? { ...option, ...patch } : option)));
  };

  return (
    <div>
      {options.map((option, index) => (
        <div key={index} style={cardStyle}>
          <div style={rowStyle}>
            <span style={labelStyle}>文案</span>
            <SmallInput
              value={option.label}
              onChange={(label) => update(index, { label })}
            />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>值</span>
            <SmallInput
              value={String(option.value ?? '')}
              onChange={(value) => update(index, { value })}
            />
            <DangerButton
              onClick={() => props.onChange?.(options.filter((_, i) => i !== index))}
            >
              删除
            </DangerButton>
          </div>
        </div>
      ))}

      <LinkButton
        onClick={() =>
          props.onChange?.([
            ...options,
            { label: `选项${options.length + 1}`, value: `option${options.length + 1}` },
          ])
        }
      >
        + 添加选项
      </LinkButton>
    </div>
  );
}
