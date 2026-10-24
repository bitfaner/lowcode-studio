import * as React from 'react';
import type {
  LinkageAction,
  LinkageActionType,
  LinkageCondition,
  LinkageOp,
  LinkageRule,
  LinkageWhen,
} from '@lc/schema';
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

const OP_OPTIONS: { label: string; value: LinkageOp }[] = [
  { label: '等于', value: 'eq' },
  { label: '不等于', value: 'neq' },
  { label: '为空', value: 'empty' },
  { label: '不为空', value: 'notEmpty' },
  { label: '大于', value: 'gt' },
  { label: '小于', value: 'lt' },
];

const ACTION_OPTIONS: { label: string; value: LinkageActionType }[] = [
  { label: '显示', value: 'show' },
  { label: '隐藏', value: 'hide' },
  { label: '启用', value: 'enable' },
  { label: '禁用', value: 'disable' },
  { label: '设为必填', value: 'setRequired' },
  { label: '设置值', value: 'setValue' },
];

const NO_VALUE_OPS: LinkageOp[] = ['empty', 'notEmpty'];
const NO_VALUE_ACTIONS: LinkageActionType[] = ['show', 'hide', 'enable', 'disable'];

function asCondition(when: LinkageWhen): LinkageCondition {
  if (when && typeof when === 'object' && 'field' in when) return when;
  return { field: '', op: 'eq', value: '' };
}

export function LinkageSetter(props: SetterProps<LinkageRule[]>) {
  const rules = Array.isArray(props.value) ? props.value : [];

  const replace = (index: number, rule: LinkageRule) => {
    props.onChange?.(rules.map((item, i) => (i === index ? rule : item)));
  };

  return (
    <div>
      {rules.map((rule, index) => {
        const condition = asCondition(rule.when);
        const actions = Array.isArray(rule.then) ? rule.then : [];

        const updateCondition = (patch: Partial<LinkageCondition>) => {
          replace(index, { ...rule, when: { ...condition, ...patch } });
        };

        const updateAction = (actionIndex: number, patch: Partial<LinkageAction>) => {
          replace(index, {
            ...rule,
            then: actions.map((action, i) =>
              i === actionIndex ? { ...action, ...patch } : action,
            ),
          });
        };

        return (
          <div key={index} style={cardStyle}>
            <div style={rowStyle}>
              <span style={labelStyle}>当字段</span>
              <SmallInput
                value={condition.field}
                placeholder="字段名"
                onChange={(field) => updateCondition({ field })}
              />
            </div>

            <div style={rowStyle}>
              <SmallSelect
                value={condition.op}
                options={OP_OPTIONS}
                onChange={(op) => updateCondition({ op: op as LinkageOp })}
              />
              <SmallInput
                value={
                  condition.value == null
                    ? ''
                    : typeof condition.value === 'object'
                      ? JSON.stringify(condition.value)
                      : String(condition.value)
                }
                placeholder="比较值"
                disabled={NO_VALUE_OPS.includes(condition.op)}
                onChange={(value) => updateCondition({ value })}
              />
            </div>

            <div style={{ ...labelStyle, paddingTop: 2 }}>则</div>

            {actions.map((action, actionIndex) => (
              <div key={actionIndex} style={rowStyle}>
                <SmallInput
                  value={action.target}
                  placeholder="目标字段"
                  onChange={(target) => updateAction(actionIndex, { target })}
                />
                <SmallSelect
                  value={action.action}
                  options={ACTION_OPTIONS}
                  onChange={(next) => {
                    const actionType = next as LinkageActionType;
                    updateAction(actionIndex, {
                      action: actionType,
                      value: NO_VALUE_ACTIONS.includes(actionType) ? undefined : action.value,
                    });
                  }}
                />
                {action.action === 'setRequired' ? (
                  <SmallSelect
                    value={action.value === false ? 'false' : 'true'}
                    options={[
                      { label: '必填', value: 'true' },
                      { label: '非必填', value: 'false' },
                    ]}
                    onChange={(value) =>
                      updateAction(actionIndex, { value: value === 'true' })
                    }
                  />
                ) : action.action === 'setValue' ? (
                  <SmallInput
                    value={action.value == null ? '' : String(action.value)}
                    placeholder="值"
                    onChange={(value) => updateAction(actionIndex, { value })}
                  />
                ) : null}
                <DangerButton
                  onClick={() =>
                    replace(index, {
                      ...rule,
                      then: actions.filter((_, i) => i !== actionIndex),
                    })
                  }
                >
                  删
                </DangerButton>
              </div>
            ))}

            <div style={rowStyle}>
              <LinkButton
                onClick={() =>
                  replace(index, {
                    ...rule,
                    then: [...actions, { target: '', action: 'show' }],
                  })
                }
              >
                + 动作
              </LinkButton>
              <DangerButton
                onClick={() => props.onChange?.(rules.filter((_, i) => i !== index))}
              >
                删除规则
              </DangerButton>
            </div>
          </div>
        );
      })}

      <div style={{ ...labelStyle, marginBottom: 6 }}>
        仅支持单条件；and/or 组合可在 JSON 中配置
      </div>
      <LinkButton
        onClick={() =>
          props.onChange?.([
            ...rules,
            { when: { field: '', op: 'eq', value: '' }, then: [] },
          ])
        }
      >
        + 添加联动
      </LinkButton>
    </div>
  );
}
