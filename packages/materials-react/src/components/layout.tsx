import * as React from 'react';
import { Button, Card, Col, Divider as AntDivider, Row, Typography } from 'antd';

export interface LcButtonProps {
  text?: string;
  type?: 'default' | 'primary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  block?: boolean;
  children?: React.ReactNode;
  onClick?: (event: unknown) => void;
}

export function LcButton(props: LcButtonProps): React.ReactElement {
  const { children, text, type = 'default', size = 'medium', ...rest } = props;
  return (
    <Button
      // antd v6 的 Button 没有 danger 类型，用 danger 布尔属性表达
      type={type === 'danger' ? 'default' : type}
      danger={type === 'danger'}
      size={size === 'medium' ? 'middle' : size}
      disabled={rest.disabled}
      block={rest.block}
      onClick={rest.onClick as never}
    >
      {children ?? text}
    </Button>
  );
}

export interface LcGridProps {
  columns?: number;
  gap?: number;
  children?: React.ReactNode;
}

export function LcGrid(props: LcGridProps): React.ReactElement {
  const columns = Math.max(1, props.columns || 1);
  const span = Math.max(1, Math.floor(24 / columns));
  const children = React.Children.toArray(props.children);
  return (
    <Row gutter={[props.gap ?? 16, props.gap ?? 16]}>
      {children.map((child, index) => (
        <Col key={index} span={span}>
          {child}
        </Col>
      ))}
    </Row>
  );
}

export interface LcSectionProps {
  title?: string;
  description?: string;
  bordered?: boolean;
  children?: React.ReactNode;
}

export function LcSection(props: LcSectionProps): React.ReactElement {
  const bordered = props.bordered ?? true;
  return (
    <Card
      size="small"
      variant={bordered ? 'outlined' : 'borderless'}
      title={props.title || undefined}
    >
      {props.description ? (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {props.description}
        </Typography.Paragraph>
      ) : null}
      {props.children}
    </Card>
  );
}

export interface LcDividerProps {
  text?: string;
  dashed?: boolean;
  children?: React.ReactNode;
}

export function LcDivider(props: LcDividerProps): React.ReactElement {
  return (
    <AntDivider dashed={props.dashed} style={{ margin: '4px 0' }}>
      {props.text}
    </AntDivider>
  );
}

export const LAYOUT_COMPONENTS = {
  LcButton,
  LcGrid,
  LcSection,
  LcDivider,
} as const;
