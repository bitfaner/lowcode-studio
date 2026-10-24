import * as React from 'react';
import type { ValidationRule } from '@lc/schema';
import {
  DangerButton,
  LinkButton,
  SmallInput,
  SmallSelect,
  cardStyle,
  labelStyle,
  rowStyle,
  type SetterProps,
} from './common.js';

type RuleKind = 'required' | 'email' | 'url' | 'min' | 'max' | 'len' | 'pattern';

const KIND_OPTIONS: { label: string; value: RuleKind }[] = [
  { label: '必填', value: 'required' },
  { label: '邮箱', value: 'email' },
  { label: 'URL', value: 'url' },
  { label: '最小值', value: 'min' },
  { label: '最大值', value: 'max' },
  { label: '长度', value: 'len' },
  { label: '正则', value: 'pattern' },
];

function detectKind(rule: ValidationRule): RuleKind {
  if (rule.required) return 'required';
  if (rule.type === 'email') return 'email';
  if (rule.type === 'url') return 'url';
  if (rule.min != null) return 'min';
  if (rule.max != null) return 'max';
  if (rule.len != null) return 'len';
  return 'pattern';
}

function ruleForKind(kind: RuleKind, message?: string): ValidationRule {
  const base = { message };
  switch (kind) {
    case 'required':
      return { required: true, ...base };
    case 'email':
      return { type: 'email', ...base };
    case 'url':
      return { type: 'url', ...base };
    case 'min':
      return { min: 0, ...base };
    case 'max':
      return { max: 0, ...base };
    case 'len':
      return { len: 0, ...base };
    default:
      return { pattern: '', ...base };
  }
}

export function RulesSetter(props: SetterProps<ValidationRule[]>) {
  const rules = Array.isArray(props.value) ? props.value : [];

  const update = (index: number, next: ValidationRule) => {
    props.onChange?.(rules.map((rule, i) => (i === index ? next : rule)));
  };

  return (
    <div>
      {rules.map((rule, index) => {
        const kind = detectKind(rule);
        return (
          <div key={index} style={cardStyle}>
            <div style={rowStyle}>
              <span style={labelStyle}>规则</span>
              <SmallSelect
                value={kind}
                options={KIND_OPTIONS}
                onChange={(nextKind) =>
                  update(index, ruleForKind(nextKind as RuleKind, rule.message))
                }
              />
              <DangerButton
                onClick={() => props.onChange?.(rules.filter((_, i) => i !== index))}
              >
                删除
              </DangerButton>
            </div>

            {kind === 'min' || kind === 'max' || kind === 'len' ? (
              <div style={rowStyle}>
                <span style={labelStyle}>数值</span>
                <SmallInput
                  type="number"
                  value={rule[kind]}
                  onChange={(text) =>
                    update(index, { ...rule, [kind]: text === '' ? undefined : Number(text) })
                  }
                />
              </div>
            ) : null}

            {kind === 'pattern' ? (
              <div style={rowStyle}>
                <span style={labelStyle}>表达式</span>
                <SmallInput
                  value={rule.pattern}
                  placeholder="例如 ^1[3-9]\\d{9}$"
                  onChange={(text) => update(index, { ...rule, pattern: text })}
                />
              </div>
            ) : null}

            <div style={rowStyle}>
              <span style={labelStyle}>提示文案</span>
              <SmallInput
                value={rule.message}
                placeholder="留空使用默认提示"
                onChange={(text) => update(index, { ...rule, message: text || undefined })}
              />
            </div>
          </div>
        );
      })}

      <LinkButton onClick={() => props.onChange?.([...rules, { required: true }])}>
        + 添加规则
      </LinkButton>
    </div>
  );
}
