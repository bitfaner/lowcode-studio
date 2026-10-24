import type { IPublicModelPluginContext } from '@alilc/lowcode-types';
import AliLowCodeEngineExt from '@alilc/lowcode-engine-ext';
import {
  ActionsSetter,
  ColumnsSetter,
  DataSourceSetter,
  LinkageSetter,
  OptionsSetter,
  RulesSetter,
} from '../setters/index.js';

/**
 * 注册引擎官方内置 setter（StringSetter / BoolSetter / SelectSetter 等）
 * 以及事件绑定、变量绑定面板。
 */
const DefaultSettersRegistryPlugin = (ctx: IPublicModelPluginContext) => ({
  name: 'lc-default-setters',
  async init() {
    // UMD 的全局对象是模块命名空间，真正的 API 挂在 default 上
    const namespace = AliLowCodeEngineExt as unknown as {
      default?: { setterMap: Record<string, unknown>; pluginMap: Record<string, unknown> };
      setterMap?: Record<string, unknown>;
      pluginMap?: Record<string, unknown>;
    };
    const ext = namespace.default ?? namespace;
    const { setterMap = {}, pluginMap = {} } = ext;
    const { setters, skeleton } = ctx;

    (setters.registerSetter as (map: Record<string, unknown>) => void)(setterMap);

    // 业务设置器：与 studio 一起打包，React 同样 external 到 window.React
    (setters.registerSetter as (map: Record<string, unknown>) => void)({
      RulesSetter: { component: RulesSetter },
      OptionsSetter: { component: OptionsSetter },
      LinkageSetter: { component: LinkageSetter },
      DataSourceSetter: { component: DataSourceSetter },
      ColumnsSetter: { component: ColumnsSetter },
      ActionsSetter: { component: ActionsSetter },
    });

    skeleton.add({
      area: 'centerArea',
      type: 'Widget',
      content: pluginMap.EventBindDialog as never,
      name: 'eventBindDialog',
      props: {},
    });

    skeleton.add({
      area: 'centerArea',
      type: 'Widget',
      content: pluginMap.VariableBindDialog as never,
      name: 'variableBindDialog',
      props: {},
    });
  },
});

(DefaultSettersRegistryPlugin as { pluginName?: string }).pluginName =
  'LcDefaultSettersRegistryPlugin';

export default DefaultSettersRegistryPlugin;
