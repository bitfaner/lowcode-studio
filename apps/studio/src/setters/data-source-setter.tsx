import * as React from 'react';
import type { DataSourceConfig, HttpMethod } from '@lc/schema';
import {
  JsonField,
  SmallInput,
  SmallSelect,
  cardStyle,
  labelStyle,
  rowStyle,
  type SetterProps,
} from './common.js';

const METHOD_OPTIONS: { label: string; value: HttpMethod }[] = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'PATCH', value: 'PATCH' },
  { label: 'DELETE', value: 'DELETE' },
];

/** 数据源配置：URL、方法、参数/请求体与响应映射 */
export function DataSourceSetter(props: SetterProps<DataSourceConfig>) {
  const config = props.value && typeof props.value === 'object' ? props.value : {};

  const patch = (next: Partial<DataSourceConfig>) => {
    props.onChange?.({ ...config, ...next } as DataSourceConfig);
  };

  return (
    <div>
      <div style={cardStyle}>
        <div style={rowStyle}>
          <span style={labelStyle}>数据源 ID</span>
          <SmallInput
            value={config.datasourceId}
            placeholder="服务端登记的数据源（可选）"
            onChange={(datasourceId) => patch({ datasourceId })}
          />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>请求地址</span>
          <SmallInput
            value={config.url}
            placeholder="/api/users"
            onChange={(url) => patch({ url })}
          />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>请求方法</span>
          <SmallSelect
            value={config.method ?? 'GET'}
            options={METHOD_OPTIONS}
            onChange={(method) => patch({ method: method as HttpMethod })}
          />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>行数据路径</span>
          <SmallInput
            value={config.response?.rows}
            placeholder="data.records"
            onChange={(rows) =>
              patch({ response: { ...(config.response ?? {}), rows } })
            }
          />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>总条数路径</span>
          <SmallInput
            value={config.response?.total}
            placeholder="data.total"
            onChange={(total) =>
              patch({ response: { ...(config.response ?? {}), total } })
            }
          />
        </div>
      </div>

      <JsonField
        label="请求参数（支持 {{page}}、{{pageSize}}、{{query.xxx}}）"
        value={config.params}
        onChange={(params) => patch({ params: params ?? undefined })}
        rows={4}
      />
      <JsonField
        label="请求体（POST/PUT/DELETE）"
        value={config.body}
        onChange={(body) => patch({ body: body ?? undefined })}
        rows={3}
      />
    </div>
  );
}
