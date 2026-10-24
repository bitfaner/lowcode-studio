import type { NodeSchema } from '@lc/schema';

export interface PropMeta {
  name: string;
  title: string;
  setter?:
    | string
    | {
        componentName: string;
        props?: Record<string, unknown>;
        initialValue?: unknown;
      };
  defaultValue?: unknown;
  condition?: (props: Record<string, unknown>) => boolean;
}

export interface SnippetMeta {
  title: string;
  schema: NodeSchema;
}

export type MaterialGroup = '表单' | '布局' | '列表' | '展示';

export interface MaterialMeta {
  componentName: string;
  tagName: string;
  title: string;
  icon?: string;
  group: MaterialGroup;
  category?: string;
  isContainer?: boolean;
  props: PropMeta[];
  events?: { name: string; title: string }[];
  snippets: SnippetMeta[];
}

const RULES_SETTER = { componentName: 'RulesSetter' };
const OPTIONS_SETTER = { componentName: 'OptionsSetter' };
const DATA_SOURCE_SETTER = { componentName: 'DataSourceSetter' };
const COLUMNS_SETTER = { componentName: 'ColumnsSetter' };
const ACTIONS_SETTER = { componentName: 'ActionsSetter' };

function fieldProps(extra: PropMeta[] = []): PropMeta[] {
  return [
    { name: 'name', title: '字段名', setter: 'StringSetter' },
    { name: 'label', title: '标题', setter: 'StringSetter' },
    { name: 'placeholder', title: '占位提示', setter: 'StringSetter' },
    { name: 'required', title: '必填', setter: 'BoolSetter', defaultValue: false },
    { name: 'rules', title: '校验规则', setter: RULES_SETTER, defaultValue: [] },
    { name: 'disabled', title: '禁用', setter: 'BoolSetter', defaultValue: false },
    { name: 'help', title: '帮助提示', setter: 'StringSetter' },
    ...extra,
  ];
}

function optionProp(title = '选项'): PropMeta {
  return {
    name: 'options',
    title,
    setter: OPTIONS_SETTER,
    defaultValue: [
      { label: '选项一', value: 'option1' },
      { label: '选项二', value: 'option2' },
    ],
  };
}

export const materials: MaterialMeta[] = [
  {
    // 引擎要求项目根节点必须是 Page / Block / Component，因此根物料命名为 Page
    componentName: 'Page',
    tagName: 'lc-page',
    title: '页面',
    icon: '/assets/icons/page.svg',
    group: '布局',
    isContainer: true,
    props: [
      { name: 'title', title: '页面标题', setter: 'StringSetter' },
      { name: 'dataSource', title: '列表数据源', setter: DATA_SOURCE_SETTER },
      { name: 'rowKey', title: '行主键', setter: 'StringSetter', defaultValue: 'id' },
      { name: 'pageSize', title: '每页条数', setter: 'NumberSetter', defaultValue: 10 },
      { name: 'formPageId', title: '关联表单页', setter: 'StringSetter' },
      { name: 'rowActions', title: '行操作', setter: ACTIONS_SETTER, defaultValue: [] },
    ],
    snippets: [
      {
        title: '页面',
        schema: {
          componentName: 'Page',
          props: { title: '未命名页面' },
          children: [],
        },
      },
    ],
  },
  {
    componentName: 'LcForm',
    tagName: 'lc-form',
    title: '表单',
    icon: '/assets/icons/form.svg',
    group: '布局',
    isContainer: true,
    props: [
      {
        name: 'layout',
        title: '布局',
        setter: {
          componentName: 'SelectSetter',
          props: {
            options: [
              { label: '垂直', value: 'vertical' },
              { label: '水平', value: 'horizontal' },
            ],
          },
        },
        defaultValue: 'vertical',
      },
      { name: 'labelWidth', title: '标签宽度', setter: 'NumberSetter', defaultValue: 100 },
      { name: 'showSubmit', title: '显示操作按钮', setter: 'BoolSetter', defaultValue: true },
      { name: 'submitText', title: '提交按钮文案', setter: 'StringSetter', defaultValue: '提交' },
      { name: 'resetText', title: '重置按钮文案', setter: 'StringSetter', defaultValue: '重置' },
      { name: 'initialValues', title: '初始值', setter: 'JsonSetter', defaultValue: {} },
      { name: 'linkages', title: '联动规则', setter: { componentName: 'LinkageSetter' }, defaultValue: [] },
      { name: 'submit', title: '提交配置', setter: 'JsonSetter' },
      { name: 'success', title: '成功响应', setter: 'JsonSetter' },
    ],
    events: [
      { name: 'onSubmit', title: '提交' },
      { name: 'onSubmitSuccess', title: '提交成功' },
    ],
    snippets: [
      {
        title: '表单',
        schema: {
          componentName: 'LcForm',
          props: {
            layout: 'vertical',
            showSubmit: true,
            submitText: '提交',
            resetText: '重置',
          },
          children: [],
        },
      },
    ],
  },
  {
    componentName: 'LcGrid',
    tagName: 'lc-grid',
    title: '栅格',
    icon: '/assets/icons/grid.svg',
    group: '布局',
    isContainer: true,
    props: [
      { name: 'columns', title: '列数', setter: 'NumberSetter', defaultValue: 2 },
      { name: 'gap', title: '间距', setter: 'NumberSetter', defaultValue: 16 },
    ],
    snippets: [
      {
        title: '两列栅格',
        schema: {
          componentName: 'LcGrid',
          props: { columns: 2, gap: 16 },
          children: [],
        },
      },
    ],
  },
  {
    componentName: 'LcSection',
    tagName: 'lc-section',
    title: '分组',
    icon: '/assets/icons/section.svg',
    group: '布局',
    isContainer: true,
    props: [
      { name: 'title', title: '分组标题', setter: 'StringSetter' },
      { name: 'description', title: '分组描述', setter: 'StringSetter' },
      { name: 'bordered', title: '显示边框', setter: 'BoolSetter', defaultValue: true },
    ],
    snippets: [
      {
        title: '分组',
        schema: {
          componentName: 'LcSection',
          props: { title: '分组标题', bordered: true },
          children: [],
        },
      },
    ],
  },
  {
    componentName: 'LcDivider',
    tagName: 'lc-divider',
    title: '分割线',
    icon: '/assets/icons/divider.svg',
    group: '布局',
    props: [
      { name: 'text', title: '文案', setter: 'StringSetter' },
      { name: 'dashed', title: '虚线', setter: 'BoolSetter', defaultValue: false },
    ],
    snippets: [
      { title: '分割线', schema: { componentName: 'LcDivider', props: {} } },
    ],
  },
  {
    componentName: 'LcInput',
    tagName: 'lc-input',
    title: '单行文本',
    icon: '/assets/icons/input.svg',
    group: '表单',
    props: fieldProps([
      { name: 'defaultValue', title: '默认值', setter: 'StringSetter' },
      { name: 'maxlength', title: '最大长度', setter: 'NumberSetter' },
      { name: 'clearable', title: '可清空', setter: 'BoolSetter', defaultValue: false },
    ]),
    events: [{ name: 'onChange', title: '值改变' }],
    snippets: [
      {
        title: '单行文本',
        schema: {
          componentName: 'LcInput',
          props: { name: 'field', label: '单行文本', placeholder: '请输入' },
        },
      },
    ],
  },
  {
    componentName: 'LcTextarea',
    tagName: 'lc-textarea',
    title: '多行文本',
    icon: '/assets/icons/textarea.svg',
    group: '表单',
    props: fieldProps([
      { name: 'rows', title: '行数', setter: 'NumberSetter', defaultValue: 3 },
      { name: 'maxlength', title: '最大长度', setter: 'NumberSetter' },
    ]),
    events: [{ name: 'onChange', title: '值改变' }],
    snippets: [
      {
        title: '多行文本',
        schema: {
          componentName: 'LcTextarea',
          props: { name: 'textarea', label: '多行文本', rows: 3 },
        },
      },
    ],
  },
  {
    componentName: 'LcNumber',
    tagName: 'lc-number',
    title: '数字输入',
    icon: '/assets/icons/number.svg',
    group: '表单',
    props: fieldProps([
      { name: 'min', title: '最小值', setter: 'NumberSetter' },
      { name: 'max', title: '最大值', setter: 'NumberSetter' },
      { name: 'step', title: '步长', setter: 'NumberSetter', defaultValue: 1 },
      { name: 'precision', title: '精度', setter: 'NumberSetter' },
    ]),
    events: [{ name: 'onChange', title: '值改变' }],
    snippets: [
      {
        title: '数字输入',
        schema: {
          componentName: 'LcNumber',
          props: { name: 'number', label: '数字输入', step: 1 },
        },
      },
    ],
  },
  {
    componentName: 'LcSelect',
    tagName: 'lc-select',
    title: '下拉选择',
    icon: '/assets/icons/select.svg',
    group: '表单',
    props: fieldProps([
      optionProp(),
      { name: 'multiple', title: '多选', setter: 'BoolSetter', defaultValue: false },
      { name: 'clearable', title: '可清空', setter: 'BoolSetter', defaultValue: true },
    ]),
    events: [{ name: 'onChange', title: '值改变' }],
    snippets: [
      {
        title: '下拉选择',
        schema: {
          componentName: 'LcSelect',
          props: {
            name: 'select',
            label: '下拉选择',
            placeholder: '请选择',
            options: [
              { label: '选项一', value: 'option1' },
              { label: '选项二', value: 'option2' },
            ],
          },
        },
      },
    ],
  },
  {
    componentName: 'LcRadioGroup',
    tagName: 'lc-radio-group',
    title: '单选组',
    icon: '/assets/icons/radio.svg',
    group: '表单',
    props: fieldProps([optionProp()]),
    events: [{ name: 'onChange', title: '值改变' }],
    snippets: [
      {
        title: '单选组',
        schema: {
          componentName: 'LcRadioGroup',
          props: {
            name: 'radio',
            label: '单选组',
            options: [
              { label: '选项一', value: 'option1' },
              { label: '选项二', value: 'option2' },
            ],
          },
        },
      },
    ],
  },
  {
    componentName: 'LcCheckboxGroup',
    tagName: 'lc-checkbox-group',
    title: '多选组',
    icon: '/assets/icons/checkbox.svg',
    group: '表单',
    props: fieldProps([optionProp()]),
    events: [{ name: 'onChange', title: '值改变' }],
    snippets: [
      {
        title: '多选组',
        schema: {
          componentName: 'LcCheckboxGroup',
          props: {
            name: 'checkbox',
            label: '多选组',
            options: [
              { label: '选项一', value: 'option1' },
              { label: '选项二', value: 'option2' },
            ],
          },
        },
      },
    ],
  },
  {
    componentName: 'LcSwitch',
    tagName: 'lc-switch',
    title: '开关',
    icon: '/assets/icons/switch.svg',
    group: '表单',
    props: fieldProps([
      { name: 'activeText', title: '开启文案', setter: 'StringSetter' },
      { name: 'inactiveText', title: '关闭文案', setter: 'StringSetter' },
    ]),
    events: [{ name: 'onChange', title: '值改变' }],
    snippets: [
      {
        title: '开关',
        schema: { componentName: 'LcSwitch', props: { name: 'enabled', label: '开关' } },
      },
    ],
  },
  {
    componentName: 'LcDate',
    tagName: 'lc-date',
    title: '日期',
    icon: '/assets/icons/date.svg',
    group: '表单',
    props: fieldProps([
      { name: 'min', title: '最小日期', setter: 'StringSetter' },
      { name: 'max', title: '最大日期', setter: 'StringSetter' },
    ]),
    events: [{ name: 'onChange', title: '值改变' }],
    snippets: [
      {
        title: '日期',
        schema: { componentName: 'LcDate', props: { name: 'date', label: '日期' } },
      },
    ],
  },
  {
    componentName: 'LcDateRange',
    tagName: 'lc-date-range',
    title: '日期区间',
    icon: '/assets/icons/date-range.svg',
    group: '表单',
    props: fieldProps(),
    events: [{ name: 'onChange', title: '值改变' }],
    snippets: [
      {
        title: '日期区间',
        schema: {
          componentName: 'LcDateRange',
          props: { name: 'dateRange', label: '日期区间' },
        },
      },
    ],
  },
  {
    componentName: 'LcButton',
    tagName: 'lc-button',
    title: '按钮',
    icon: '/assets/icons/button.svg',
    group: '展示',
    props: [
      { name: 'text', title: '文案', setter: 'StringSetter' },
      {
        name: 'type',
        title: '类型',
        setter: {
          componentName: 'SelectSetter',
          props: {
            options: [
              { label: '默认', value: 'default' },
              { label: '主要', value: 'primary' },
              { label: '危险', value: 'danger' },
              { label: '文本', value: 'text' },
            ],
          },
        },
        defaultValue: 'default',
      },
      { name: 'size', title: '尺寸', setter: 'StringSetter', defaultValue: 'medium' },
      { name: 'disabled', title: '禁用', setter: 'BoolSetter' },
      { name: 'block', title: '撑满', setter: 'BoolSetter' },
    ],
    events: [{ name: 'onClick', title: '点击' }],
    snippets: [
      {
        title: '按钮',
        schema: {
          componentName: 'LcButton',
          props: { text: '按钮', type: 'default' },
        },
      },
    ],
  },
  {
    componentName: 'LcQueryForm',
    tagName: 'lc-query-form',
    title: '查询表单',
    icon: '/assets/icons/query-form.svg',
    group: '列表',
    isContainer: true,
    props: [
      { name: 'columns', title: '列数', setter: 'NumberSetter', defaultValue: 3 },
      { name: 'submitText', title: '查询按钮文案', setter: 'StringSetter', defaultValue: '查询' },
      { name: 'resetText', title: '重置按钮文案', setter: 'StringSetter', defaultValue: '重置' },
      { name: 'initialValues', title: '初始值', setter: 'JsonSetter', defaultValue: {} },
      { name: 'linkages', title: '联动规则', setter: { componentName: 'LinkageSetter' }, defaultValue: [] },
    ],
    events: [{ name: 'onQuery', title: '查询' }],
    snippets: [
      {
        title: '查询表单',
        schema: {
          componentName: 'LcQueryForm',
          props: { columns: 3 },
          children: [
            {
              componentName: 'LcInput',
              props: { name: 'keyword', label: '关键字', placeholder: '请输入关键字' },
            },
            {
              componentName: 'LcSelect',
              props: {
                name: 'status',
                label: '状态',
                placeholder: '请选择状态',
                options: [
                  { label: '启用', value: 'active' },
                  { label: '停用', value: 'disabled' },
                ],
              },
            },
          ],
        },
      },
    ],
  },
  {
    componentName: 'LcToolbar',
    tagName: 'lc-toolbar',
    title: '工具栏',
    icon: '/assets/icons/toolbar.svg',
    group: '列表',
    props: [
      { name: 'actions', title: '操作按钮', setter: ACTIONS_SETTER, defaultValue: [] },
    ],
    snippets: [
      {
        title: '工具栏',
        schema: {
          componentName: 'LcToolbar',
          props: {
            actions: [
              { key: 'create', title: '新建', type: 'primary', mode: 'create' },
              {
                key: 'batchDelete',
                title: '批量删除',
                type: 'danger',
                requireSelection: true,
                confirm: '确认删除选中的数据？',
              },
            ],
          },
        },
      },
    ],
  },
  {
    componentName: 'LcTable',
    tagName: 'lc-table',
    title: '数据表格',
    icon: '/assets/icons/table.svg',
    group: '列表',
    props: [
      { name: 'columns', title: '列配置', setter: COLUMNS_SETTER, defaultValue: [] },
      { name: 'selection', title: '显示选择列', setter: 'BoolSetter', defaultValue: false },
      { name: 'pagination', title: '显示分页', setter: 'BoolSetter', defaultValue: true },
      {
        name: 'pageSizeOptions',
        title: '每页条数选项',
        setter: 'JsonSetter',
        defaultValue: [10, 20, 50],
      },
      { name: 'emptyText', title: '空数据文案', setter: 'StringSetter', defaultValue: '暂无数据' },
    ],
    snippets: [
      {
        title: '数据表格',
        schema: {
          componentName: 'LcTable',
          props: {
            selection: true,
            pagination: true,
            columns: [
              { dataIndex: 'name', title: '名称' },
              {
                dataIndex: 'status',
                title: '状态',
                type: 'tag',
                valueEnum: {
                  active: { text: '启用', color: 'success' },
                  disabled: { text: '停用', color: 'neutral' },
                },
              },
              { dataIndex: 'createdAt', title: '创建时间', type: 'date', width: 180 },
            ],
          },
        },
      },
    ],
  },
];
