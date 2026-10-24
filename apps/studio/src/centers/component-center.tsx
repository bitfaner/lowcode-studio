import * as React from 'react';
import { Button, Card, Empty, Input, Segmented, Space, Tag, Typography } from 'antd';
import { materials, type MaterialMeta } from '@lc/materials';
import {
  LcButton, LcCheckboxGroup, LcDate, LcDateRange, LcDivider, LcForm, LcGrid, LcInput,
  LcNumber, LcQueryForm, LcRadioGroup, LcSection, LcSelect, LcSwitch, LcTable, LcTextarea,
  LcToolbar,
} from '@lc/materials-react';

type Filter = 'all' | 'form' | 'table';

const DESCRIPTIONS: Record<string, string> = {
  Page: '页面根容器，承载表单页或列表页的数据与行操作。',
  LcForm: 'antd 表单容器，负责字段注册、校验、联动和提交。',
  LcGrid: '栅格容器（antd Row/Col），用于组合多个字段或内容块。',
  LcSection: '带标题与描述的分组卡片。',
  LcDivider: '分割线，可显示分组文案。',
  LcInput: '基于 antd Input 的单行文本输入。',
  LcTextarea: '基于 antd Input.TextArea 的多行输入。',
  LcNumber: '基于 antd InputNumber 的数字输入。',
  LcSelect: '基于 antd Select 的下拉选择，支持多选。',
  LcRadioGroup: 'antd Radio.Group 单选组。',
  LcCheckboxGroup: 'antd Checkbox.Group 多选组。',
  LcSwitch: 'antd Switch 布尔字段。',
  LcDate: 'antd DatePicker 日期字段。',
  LcDateRange: '日期区间字段，值形如 [start, end]。',
  LcButton: 'antd Button，可绑定页面事件。',
  LcQueryForm: '列表页查询条件容器（antd Form + 栅格）。',
  LcToolbar: '列表页工具栏，承载新建、批量操作等按钮。',
  LcTable: 'antd Table，支持列配置、选择、排序、分页与行操作。',
  LcFormDrawer: '运行时抽屉表单容器。',
};

function matchesFilter(meta: MaterialMeta, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'table') return meta.group === '列表';
  return (
    meta.group === '表单' || meta.componentName === 'LcForm' || meta.componentName === 'LcQueryForm'
  );
}

/** 每个物料的真实 React + antd 预览。 */
function Preview({ componentName }: { componentName: string }): React.ReactElement {
  switch (componentName) {
    case 'LcForm':
      return (
        <LcForm layout="vertical" showSubmit={false}>
          <LcInput name="name" label="姓名" placeholder="请输入姓名" required />
          <LcSelect
            name="department"
            label="部门"
            placeholder="请选择"
            options={[
              { label: '产品部', value: 'product' },
              { label: '研发部', value: 'engineering' },
            ]}
          />
        </LcForm>
      );
    case 'LcQueryForm':
      return (
        <LcQueryForm columns={2} showSubmit={false}>
          <LcInput name="keyword" label="关键字" placeholder="搜索名称" />
          <LcSelect
            name="status"
            label="状态"
            placeholder="请选择"
            options={[
              { label: '启用', value: 'active' },
              { label: '停用', value: 'disabled' },
            ]}
          />
        </LcQueryForm>
      );
    case 'LcGrid':
      return (
        <LcGrid columns={2} gap={12}>
          <LcSection title="左栏" bordered />
          <LcSection title="右栏" bordered />
        </LcGrid>
      );
    case 'LcSection':
      return (
        <LcSection title="基础信息" description="分组内容" bordered>
          <LcInput name="title" label="名称" placeholder="请输入" />
        </LcSection>
      );
    case 'LcDivider':
      return <LcDivider text="内容分组" />;
    case 'LcInput':
      return <LcInput name="name" label="姓名" placeholder="请输入姓名" required />;
    case 'LcTextarea':
      return <LcTextarea name="description" label="描述" placeholder="请输入描述" />;
    case 'LcNumber':
      return <LcNumber name="count" label="数量" value={12} />;
    case 'LcSelect':
      return (
        <LcSelect
          name="status"
          label="状态"
          placeholder="请选择状态"
          options={[
            { label: '启用', value: 'active' },
            { label: '停用', value: 'disabled' },
          ]}
        />
      );
    case 'LcRadioGroup':
      return (
        <LcRadioGroup
          name="level"
          label="优先级"
          options={[
            { label: '普通', value: 'normal' },
            { label: '紧急', value: 'urgent' },
          ]}
        />
      );
    case 'LcCheckboxGroup':
      return (
        <LcCheckboxGroup
          name="tags"
          label="标签"
          options={[
            { label: '重点', value: 'important' },
            { label: '跟进', value: 'followup' },
          ]}
        />
      );
    case 'LcSwitch':
      return <LcSwitch name="enabled" label="启用" value />;
    case 'LcDate':
      return <LcDate name="date" label="日期" />;
    case 'LcDateRange':
      return <LcDateRange name="range" label="日期区间" />;
    case 'LcButton':
      return <LcButton text="主要操作" type="primary" />;
    case 'LcToolbar':
      return (
        <LcToolbar
          actions={[
            { key: 'create', title: '新建', type: 'primary' },
            { key: 'batchDelete', title: '批量删除', type: 'danger', requireSelection: true },
          ]}
        />
      );
    case 'LcTable':
      return (
        <LcTable
          columns={[
            { dataIndex: 'name', title: '名称', sortable: true },
            {
              dataIndex: 'status',
              title: '状态',
              type: 'tag',
              valueEnum: {
                active: { text: '启用', color: 'success' },
                disabled: { text: '停用', color: 'neutral' },
              },
            },
            { dataIndex: 'createdAt', title: '创建时间', type: 'date', width: 170 },
          ]}
          pagination={false}
        />
      );
    case 'Page':
    default:
      return <LcSection title="示例页面" description="页面根容器" />;
  }
}

export function ComponentCenter(): React.ReactElement {
  const [filter, setFilter] = React.useState<Filter>('all');
  const [keyword, setKeyword] = React.useState('');

  const list = React.useMemo(() => {
    const text = keyword.trim().toLowerCase();
    return materials.filter((meta) => {
      if (!matchesFilter(meta, filter)) return false;
      if (!text) return true;
      return [meta.title, meta.componentName, meta.tagName].some((value) =>
        value.toLowerCase().includes(text),
      );
    });
  }, [filter, keyword]);

  const openDesigner = () => {
    window.dispatchEvent(new CustomEvent('lc-open-designer', { bubbles: true }));
  };

  return (
    <div className="lc-center" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <Typography.Text type="secondary" style={{ fontSize: 11, letterSpacing: 1 }}>
            COMPONENT CENTER
          </Typography.Text>
          <Typography.Title level={3} style={{ margin: '4px 0' }}>
            组件中心
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            这里展示由 <strong>React + Ant Design 6</strong> 实现的表单、表格与页面物料，
            下面的示例都是真实渲染的组件。
          </Typography.Paragraph>
        </div>
        <Button type="primary" onClick={openDesigner}>
          进入设计中心
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Segmented
          value={filter}
          onChange={(value) => setFilter(value as Filter)}
          options={[
            { label: '全部组件', value: 'all' },
            { label: '表单组件', value: 'form' },
            { label: '表格组件', value: 'table' },
          ]}
        />
        <Input.Search
          allowClear
          placeholder="搜索组件"
          style={{ width: 240 }}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </Space>

      {list.length === 0 ? (
        <Empty description="没有匹配的组件" />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {list.map((meta) => (
            <Card
              key={meta.componentName}
              size="small"
              title={
                <Space>
                  <strong>{meta.title}</strong>
                  <Tag>{meta.componentName}</Tag>
                </Space>
              }
            >
              <Typography.Paragraph type="secondary" style={{ fontSize: 12, minHeight: 40 }}>
                {DESCRIPTIONS[meta.componentName] ?? meta.title}
              </Typography.Paragraph>
              <div data-component-preview={meta.componentName} style={{ minHeight: 60 }}>
                <Preview componentName={meta.componentName} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
