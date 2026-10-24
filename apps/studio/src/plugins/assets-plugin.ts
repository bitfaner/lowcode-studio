import type { IPublicModelPluginContext } from '@alilc/lowcode-types';
import type { ProjectSchema } from '@lc/schema';
import { designerBridge } from '../designer/designer-bridge.js';

export const ASSETS_URL = '/assets/assets.json';

/**
 * 加载物料资产并导入初始 schema。
 * 放在插件注册链的最后，保证其他插件先完成初始化。
 */
export function createAssetsPlugin(
  getInitialSchema: () => ProjectSchema | Promise<ProjectSchema>,
) {
  const plugin = (ctx: IPublicModelPluginContext) => ({
    name: 'lc-assets',
    async init() {
      designerBridge.attach(ctx.project as never);

      const response = await fetch(ASSETS_URL, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`加载物料资产失败：${response.status} ${response.statusText}`);
      }
      const assets = await response.json();
      await ctx.material.setAssets(assets);
      // 先加载物料，再导入草稿；草稿可能依赖物料 setter 的元信息
      await ctx.project.importSchema((await getInitialSchema()) as never);

      // 导入完成后再监听变更，避免把初始化误判为用户修改
      const doc = (ctx.project as unknown as {
        getCurrentDocument?: () => {
          onChangeNodeProp?: (fn: () => void) => void;
          onChangeNodeChildren?: (fn: () => void) => void;
          onChangeNodeVisible?: (fn: () => void) => void;
        } | null;
      }).getCurrentDocument?.();
      const markDirty = () => designerBridge.markDirty(true);
      doc?.onChangeNodeProp?.(markDirty);
      doc?.onChangeNodeChildren?.(markDirty);
      doc?.onChangeNodeVisible?.(markDirty);
    },
  });

  (plugin as { pluginName?: string }).pluginName = 'LcAssetsPlugin';
  return plugin;
}
