import * as React from 'react';
import type { ActionConfig, DataSourceConfig, HttpMethod } from '@lc/schema';
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

const TYPE_OPTIONS: { label: string; value: NonNullable<ActionConfig['type']> }[] = [
  { label: '默认', value: 'default' },
  { label: '主要', value: 'primary' },
  { label: '危险', value: 'danger' },
];

const MODE_OPTIONS: { label: string; value: NonNullable<ActionConfig['mode']> }[] = [
  { label: '新建', value: 'create' },
  { label: '编辑', value: 'edit' },
];

const METHOD_OPTIONS: { label: string; value: HttpMethod }[] = [
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'DELETE', value: 'DELETE' },
  { label: 'GET', value: 'GET' },
];

/**
 * 工具栏 / 行操作配置。
 * 一个操作要么打开表单页（formPageId），要么直接发起请求（request）。
 */
export function ActionsSetter(props: SetterProps<ActionConfig[]>) {
  const actions = Array.isArray(props.value) ? props.value : [];

  const replace = (index: number, next: ActionConfig) => {
    props.onChange?.(actions.map((action, i) => (i === index ? next : action)));
  };

  const patchRequest = (index: number, action: ActionConfig, patch: Partial<DataSourceConfig> | null) => {
    if (patch === null) {
      const next = { ...action };
      delete next.request;
      replace(index, next);
      return;
    }
    replace(index, { ...action, request: { ...(action.request ?? {}), ...patch } });
  };

  return (
    <div>
      {actions.map((action, index) => (
        <div key={`${action.key}-${index}`} style={cardStyle}>
          <div style={rowStyle}>
            <span style={labelStyle}>标识</span>
            <SmallInput
              value={action.key}
              placeholder="edit"
              onChange={(key) => replace(index, { ...action, key })}
            />
            <span style={labelStyle}>文案</span>
            <SmallInput
              value={action.title}
              placeholder="编辑"
              onChange={(title) => replace(index, { ...action, title })}
            />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>样式</span>
            <SmallSelect
              value={action.type ?? 'default'}
              options={TYPE_OPTIONS}
              onChange={(type) =>
                replace(index, { ...action, type: type as ActionConfig['type'] })
              }
            />
            <label style={{ ...labelStyle, display: 'flex', gap: 4 }}>
              <input
                type="checkbox"
                checked={Boolean(action.requireSelection)}
                onChange={(event) =>
                  replace(index, { ...action, requireSelection: event.target.checked })
                }
              />
              需先选择
            </label>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>表单页</span>
            <SmallInput
              value={action.formPageId}
              placeholder="page_user_form"
              onChange={(formPageId) => replace(index, { ...action, formPageId })}
            />
            <SmallSelect
              value={action.mode ?? 'edit'}
              options={MODE_OPTIONS}
              onChange={(mode) =>
                replace(index, { ...action, mode: mode as ActionConfig['mode'] })
              }
            />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>确认文案</span>
            <SmallInput
              value={action.confirm}
              placeholder="留空则不确认"
              onChange={(confirm) => replace(index, { ...action, confirm })}
            />
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>请求地址</span>
            <SmallInput
              value={action.request?.url}
              placeholder="留空则使用表单页"
              onChange={(url) =>
                patchRequest(index, action, url ? { url } : null)
              }
            />
            {action.request ? (
              <SmallSelect
                value={action.request.method ?? 'POST'}
                options={METHOD_OPTIONS}
                onChange={(method) =>
                  patchRequest(index, action, { method: method as HttpMethod })
                }
              />
            ) : null}
          </div>

          <div style={rowStyle}>
            <DangerButton
              onClick={() => props.onChange?.(actions.filter((_, i) => i !== index))}
            >
              删除操作
            </DangerButton>
          </div>
        </div>
      ))}

      <LinkButton
        onClick={() =>
          props.onChange?.([
            ...actions,
            { key: `action${actions.length + 1}`, title: `操作${actions.length + 1}` },
          ])
        }
      >
        + 添加操作
      </LinkButton>
    </div>
  );
}
