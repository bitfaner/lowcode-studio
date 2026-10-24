import * as React from 'react';

export interface SetterProps<T> {
  value?: T;
  onChange?: (value: T) => void;
  field?: unknown;
}

export const inputStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  height: 28,
  padding: '0 8px',
  fontSize: 12,
  color: '#1f2329',
  background: '#fff',
  border: '1px solid #c9cdd4',
  borderRadius: 3,
  outline: 'none',
};

export const selectStyle: React.CSSProperties = {
  ...inputStyle,
  padding: '0 4px',
};

export const smallButtonStyle: React.CSSProperties = {
  height: 28,
  padding: '0 10px',
  fontSize: 12,
  color: '#1f2329',
  background: '#f2f3f5',
  border: '1px solid #e5e6eb',
  borderRadius: 3,
  cursor: 'pointer',
};

export const dangerButtonStyle: React.CSSProperties = {
  ...smallButtonStyle,
  color: '#f53f3f',
};

export const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 8,
  marginBottom: 8,
  background: '#f7f8fa',
  border: '1px solid #e5e6eb',
  borderRadius: 4,
};

export const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

export const labelStyle: React.CSSProperties = {
  flex: '0 0 auto',
  fontSize: 12,
  color: '#4e5969',
  whiteSpace: 'nowrap',
};

interface InputProps {
  value: string | number | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
  disabled?: boolean;
  title?: string;
}

export function SmallInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
  title,
}: InputProps) {
  return (
    <input
      style={inputStyle}
      type={type}
      value={value ?? ''}
      placeholder={placeholder}
      disabled={disabled}
      title={title}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}

export function SmallSelect({ value, onChange, options }: SelectProps) {
  return (
    <select
      style={selectStyle}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * JSON 文本编辑器：输入过程中允许非法 JSON，失焦后才解析并回写，
 * 避免用户每敲一个字符就被格式化打断。
 */
export function JsonField<T>({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label?: string;
  value: T | undefined;
  onChange: (value: T) => void;
  rows?: number;
}) {
  const serialized = React.useMemo(() => JSON.stringify(value ?? null, null, 2), [value]);
  const [text, setText] = React.useState(serialized);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setText(serialized);
    setError('');
  }, [serialized]);

  const commit = (next: string) => {
    try {
      const parsed = next.trim() === '' ? null : JSON.parse(next);
      setError('');
      onChange(parsed as T);
    } catch {
      setError('JSON 格式不正确');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label ? <span style={labelStyle}>{label}</span> : null}
      <textarea
        style={{ ...inputStyle, height: 'auto', padding: '6px 8px', resize: 'vertical' }}
        rows={rows}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
      />
      {error ? <span style={{ fontSize: 12, color: '#f53f3f' }}>{error}</span> : null}
    </div>
  );
}

export const LinkButton = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button type="button" style={smallButtonStyle} onClick={onClick}>
    {children}
  </button>
);

export const DangerButton = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <button type="button" style={dangerButtonStyle} onClick={onClick}>
    {children}
  </button>
);
