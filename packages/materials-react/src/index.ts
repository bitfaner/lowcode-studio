import * as React from 'react';
import { materials } from '@lc/materials';
import { LcPage, LcToolbar, LcTable, LcFormDrawer } from './components/list.js';
import { LcForm, LcQueryForm } from './components/form.js';
import { LcButton, LcGrid, LcSection, LcDivider } from './components/layout.js';
import {
  LcInput,
  LcTextarea,
  LcNumber,
  LcSelect,
  LcRadioGroup,
  LcCheckboxGroup,
  LcSwitch,
  LcDate,
  LcDateRange,
} from './components/fields.js';
import {
  FormBridgeContext,
  FormContext,
  FormValuesContext,
  PageContext,
  useField,
  validateFieldValue,
} from './field.js';

export {
  // 容器
  LcPage,
  LcForm,
  LcQueryForm,
  LcToolbar,
  LcTable,
  LcFormDrawer,
  LcGrid,
  LcSection,
  LcDivider,
  LcButton,
  // 字段
  LcInput,
  LcTextarea,
  LcNumber,
  LcSelect,
  LcRadioGroup,
  LcCheckboxGroup,
  LcSwitch,
  LcDate,
  LcDateRange,
  // 基础设施
  FormBridgeContext,
  FormContext,
  FormValuesContext,
  PageContext,
  useField,
  validateFieldValue,
};

/**
 * 引擎要求项目根节点名为 Page。
 *
 * 必须是类组件：renderer-core 的 entry 先用 components[componentName] 取根组件，
 * 取到类（有 prototype）且非内置 BaseRenderer 时会改用内置 PageRenderer，
 * 由 PageRenderer 渲染 schema.children。函数组件拿不到 children。
 */
export class Page extends React.Component<Record<string, unknown>> {
  render(): React.ReactNode {
    const { children, ...rest } = this.props;
    return React.createElement(LcPage, rest as never, children as React.ReactNode);
  }
}

/**
 * 供 assets.json / 运行时 componentsMap 使用：componentName -> React 组件。
 *
 * 只登记 metadata（packages/materials/src/meta.ts）中存在的物料，
 * 由 tools/check-material-parity.ts 在构建期校验三方一致。
 * LcFormDrawer 不在物料清单内（LcPage 内部已用 antd Drawer 实现），
 * 因此只作为普通导出保留，不进 componentsMap，避免出现设计器无法放置却能渲染的组件。
 */
export const components: Record<string, React.ComponentType<Record<string, unknown>>> = {
  Page,
  LcForm,
  LcQueryForm,
  LcToolbar,
  LcTable,
  LcGrid,
  LcSection,
  LcDivider,
  LcInput,
  LcTextarea,
  LcNumber,
  LcSelect,
  LcRadioGroup,
  LcCheckboxGroup,
  LcSwitch,
  LcDate,
  LcDateRange,
  LcButton,
} as never;

export { materials };

export function buildComponentsMap(): Record<string, React.ComponentType<Record<string, unknown>>> {
  const map: Record<string, React.ComponentType<Record<string, unknown>>> = {};
  for (const meta of materials) {
    const component = components[meta.componentName];
    if (component) map[meta.componentName] = component;
  }
  return map;
}
