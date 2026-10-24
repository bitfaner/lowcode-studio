import * as React from 'react';
import type { ColumnConfig, ColumnValueType } from '@lc/schema';
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

const TYPE_OPTIONS: { label: string; value: ColumnValueType }[] = [
  { label: '文本', value: 'text' },
  { label: '标签', value: 'tag' },
  { label: '日期', value: 'date' },
  { label: '链接', value: 'link' },
  { label: '操作', value: 'action' },
];

/** 表格列配置：字段、标题、类型、宽度、排序与标签映射 */
export function ColumnsSetter(props: SetterProps<ColumnConfig[]>) {
  const columns = Array.isArray(props.value) ? props.value : [];

  const replace = (index: number, next: ColumnConfig) => {
    props.onChange?.(columns.map((column, i) => (i === index ? next : column)));
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    [next[index], next[target]] = [next[target], next[index]];
    props.onChange?.(next);
  };

  return (
    <div>
      {columns.map((column, index) => (
        <div key={`${column.dataIndex}-${index}`} style={cardStyle}>
          <div style={rowStyle}>
            <span style={labelStyle}>字段</span>
            <SmallInput
              value={column.dataIndex}
              placeholder="dataIndex"
              onChange={(dataIndex) => replace(index, { ...column, dataIndex })}
            />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>标题</span>
            <SmallInput
              value={column.title}
              placeholder="列标题"
              onChange={(title) => replace(index, { ...column, title })}
            />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>类型</span>
            <SmallSelect
              value={column.type ?? 'text'}
              options={TYPE_OPTIONS}
              onChange={(type) =>
                replace(index, { ...column, type: type as ColumnValueType })
              }
            />
            <span style={labelStyle}>宽度</span>
            <SmallInput
              type="number"
              value={column.width}
              placeholder="px"
              onChange={(text) =>
                replace(index, {
                  ...column,
                  width: text === '' ? undefined : Number(text),
                })
              }
            />
          </div>
          <div style={rowStyle}>
            <label style={{ ...labelStyle, display: 'flex', gap: 4 }}>
              <input
                type="checkbox"
                checked={Boolean(column.sortable)}
                onChange={(event) =>
                  replace(index, { ...column, sortable: event.target.checked })
                }
              />
              可排序
            </label>
            <label style={{ ...labelStyle, display: 'flex', gap: 4 }}>
              <input
                type="checkbox"
                checked={Boolean(column.ellipsis)}
                onChange={(event) =>
                  replace(index, { ...column, ellipsis: event.target.checked })
                }
              />
              省略
            </label>
            <LinkButton onClick={() => move(index, -1)}>↑</LinkButton>
            <LinkButton onClick={() => move(index, 1)}>↓</LinkButton>
            <DangerButton
              onClick={() => props.onChange?.(columns.filter((_, i) => i !== index))}
            >
              删除
            </DangerButton>
          </div>
          {column.type === 'tag' ? (
            <TagEnumField
              value={column.valueEnum}
              onChange={(valueEnum) => replace(index, { ...column, valueEnum })}
            />
          ) : null}
        </div>
      ))}

      <LinkButton
        onClick={() =>
          props.onChange?.([
            ...columns,
            {
              dataIndex: `field${columns.length + 1}`,
              title: `列${columns.length + 1}`,
              type: 'text',
            },
          ])
        }
      >
        + 添加列
      </LinkButton>
    </div>
  );
}

function TagEnumField({
  value,
  onChange,
}: {
  value?: ColumnConfig['valueEnum'];
  onChange: (value: ColumnConfig['valueEnum']) => void;
}) {
  const raw = React.useMemo(() => JSON.stringify(value ?? {}, null, 2), [value]);
  const [text, setText] = React.useState(raw);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setText(raw);
    setError('');
  }, [raw]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={labelStyle}>标签映射 {`{ value: { text, color } }`}</span>
      <textarea
        rows={3}
        value={text}
        style={{
          boxSizing: 'border-box',
          width: '100%',
          padding: '6px 8px',
          fontSize: 12,
          fontFamily: 'monospace',
          border: '1px solid #c9cdd4',
          borderRadius: 3,
        }}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          try {
            onChange(text.trim() ? JSON.parse(text) : undefined);
            setError('');
          } catch {
            setError('JSON 格式不正确');
          }
        }}
      />
      {error ? <span style={{ fontSize: 12, color: '#f53f3f' }}>{error}</span> : null}
    </div>
  );
}
