import * as React from 'react';
import { Alert, Button, Col, Form as AntForm, Row, Space } from 'antd';
import {
  DataClient,
  FormController,
  buildSubmitContext,
  buildSubmitRequest,
  type FormValues,
} from '@lc/page-runtime';
import type { DataSourceConfig, LinkageRule, SuccessConfig } from '@lc/schema';
import { FormContext, FormValuesContext, PageContext } from '../field.js';

export interface LcFormProps {
  layout?: 'vertical' | 'horizontal';
  labelWidth?: number;
  initialValues?: FormValues;
  linkages?: LinkageRule[];
  submit?: DataSourceConfig;
  success?: SuccessConfig;
  showSubmit?: boolean;
  submitText?: string;
  resetText?: string;
  __designMode?: 'design' | 'live';
  onSubmit?: (detail: { values: FormValues }) => void;
  onSubmitSuccess?: (detail: { values: FormValues; success?: SuccessConfig }) => void;
  children?: React.ReactNode;
}

interface FormRuntime {
  controller: FormController;
  loading: boolean;
  message: string;
  messageType: 'success' | 'error' | '';
  submit: () => Promise<void>;
  reset: () => void;
}

/**
 * 表单页与查询表单共用的控制器 / 校验 / 提交逻辑。
 *
 * injectedValues 是抽屉表单的行数据（运行时通过 FormValuesContext 下发），
 * 优先级高于 schema 上的 initialValues：编辑态应以当前行数据回填。
 */
export function useFormRuntime(props: LcFormProps, injectedValues?: FormValues): FormRuntime {
  const controller = React.useMemo(() => new FormController(), []);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [messageType, setMessageType] = React.useState<'success' | 'error' | ''>('');

  const seedValues = React.useMemo<FormValues | undefined>(() => {
    if (!injectedValues) return props.initialValues;
    return { ...(props.initialValues ?? {}), ...injectedValues };
  }, [props.initialValues, injectedValues]);

  React.useEffect(() => {
    if (seedValues) controller.setInitialValues(seedValues);
  }, [controller, seedValues]);

  React.useEffect(() => {
    controller.setLinkages(props.linkages);
  }, [controller, props.linkages]);

  const reset = React.useCallback(() => {
    controller.reset();
    setMessage('');
    setMessageType('');
  }, [controller]);

  const submit = React.useCallback(async () => {
    if (loading) return;
    const { valid } = await controller.validate();
    props.onSubmit?.({ values: controller.getValues() });
    if (!valid) return;

    const values = controller.getValues();
    if (props.__designMode === 'design') {
      setMessage('校验通过（设计态不会发送请求）');
      setMessageType('success');
      return;
    }
    if (!props.submit?.url && !props.submit?.datasourceId) {
      setMessage('未配置提交接口');
      setMessageType('error');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const client = new DataClient();
      const config = buildSubmitRequest(props.submit as DataSourceConfig, values);
      await client.request(config, buildSubmitContext(values));
      setMessage(props.success?.message ?? '提交成功');
      setMessageType('success');
      props.onSubmitSuccess?.({ values, success: props.success });
      if (props.success?.action === 'reload') window.location.reload();
      if (props.success?.action === 'redirect' && props.success.redirectUrl) {
        window.location.assign(props.success.redirectUrl);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }, [controller, loading, props]);

  return { controller, loading, message, messageType, submit, reset };
}

function FormMessage(props: { message: string; type: 'success' | 'error' | '' }): React.ReactElement | null {
  if (!props.message) return null;
  if (props.type === 'error') return <Alert type="error" showIcon message={props.message} />;
  if (props.type === 'success') return <Alert type="success" showIcon message={props.message} />;
  return <Alert type="info" showIcon message={props.message} />;
}

export function LcForm(props: LcFormProps): React.ReactElement {
  const runtime = useFormRuntime(props, React.useContext(FormValuesContext));
  const horizontal = props.layout === 'horizontal';
  return (
    <FormContext.Provider value={runtime.controller}>
      <AntForm
        layout={horizontal ? 'horizontal' : 'vertical'}
        labelCol={horizontal ? { flex: `${props.labelWidth ?? 100}px` } : undefined}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{props.children}</div>
        {props.showSubmit !== false ? (
          <AntForm.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" loading={runtime.loading} onClick={() => void runtime.submit()}>
                {props.submitText ?? '提交'}
              </Button>
              <Button disabled={runtime.loading} onClick={runtime.reset}>
                {props.resetText ?? '重置'}
              </Button>
            </Space>
          </AntForm.Item>
        ) : null}
        <FormMessage message={runtime.message} type={runtime.messageType} />
      </AntForm>
    </FormContext.Provider>
  );
}

export interface LcQueryFormProps extends LcFormProps {
  columns?: number;
}

export function LcQueryForm(props: LcQueryFormProps): React.ReactElement {
  const page = React.useContext(PageContext);
  const runtime = useFormRuntime(props);
  const columns = Math.max(1, props.columns || 3);
  const span = Math.max(1, Math.floor(24 / columns));
  const children = React.Children.toArray(props.children);

  /**
   * 查询 / 重置需要把条件写进所在页面的 PageController。
   * 配置了远端提交时先走表单提交（含校验），否则只下发查询条件。
   */
  const runQuery = React.useCallback(async () => {
    if (props.submit?.url || props.submit?.datasourceId) await runtime.submit();
    await page?.controller.setQuery(runtime.controller.getValues());
  }, [page, props.submit, runtime]);

  const resetQuery = React.useCallback(async () => {
    runtime.reset();
    await page?.controller.resetQuery();
  }, [page, runtime]);

  return (
    <FormContext.Provider value={runtime.controller}>
      <AntForm
        layout="horizontal"
        labelCol={{ flex: `${props.labelWidth ?? 100}px` }}
        style={{ padding: 16, background: '#fff', borderRadius: 6 }}
      >
        <Row gutter={16}>
          {children.map((child, index) => (
            <Col key={index} span={span}>
              {child}
            </Col>
          ))}
        </Row>
        {props.showSubmit !== false ? (
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button type="primary" onClick={() => void runQuery()}>
                {props.submitText ?? '查询'}
              </Button>
              <Button onClick={() => void resetQuery()}>{props.resetText ?? '重置'}</Button>
            </Space>
          </div>
        ) : null}
        <FormMessage message={runtime.message} type={runtime.messageType} />
      </AntForm>
    </FormContext.Provider>
  );
}

export const FORM_COMPONENTS = { LcForm, LcQueryForm } as const;
