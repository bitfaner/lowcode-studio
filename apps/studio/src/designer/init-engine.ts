import ComponentsPanePlugin from '@alilc/lowcode-plugin-components-pane';
import * as React from 'react';
import UndoRedoPlugin from '@alilc/lowcode-plugin-undo-redo';
import type { ProjectSchema } from '@lc/schema';
import { createAssetsPlugin } from '../plugins/assets-plugin.js';
import DefaultSettersRegistryPlugin from '../plugins/default-setters-registry.js';
import { createDefaultProjectSchema } from '../schema.js';
import { ComponentsPaneIcon } from './components-pane-icon.js';

export interface InitDesignerOptions {
  /** 异步加载页面草稿；缺省使用空白列表页 */
  getInitialSchema?: () => ProjectSchema | Promise<ProjectSchema>;
}

let bootPromise: Promise<void> | null = null;

/**
 * 替换 components-pane 默认的 NextIcon 字段图标。
 * NextIcon 依赖远程字体，加载失败时左侧入口会显示为空白。
 */
function registerComponentsPaneIcon(engine: Window['AliLowCodeEngine']): void {
  engine.skeleton?.registerConfigTransducer(
    (config) => {
      if (config.type !== 'PanelDock' || config.name !== 'componentsPane') return config;
      return {
        ...config,
        props: {
          ...config.props,
          icon: React.createElement(ComponentsPaneIcon),
        },
      };
    },
    1000,
    'lc-components-pane-icon',
  );
}

/**
 * 自动展开左侧「组件库」面板。
 *
 * components-pane 插件默认只注册一个折叠的 dock 图标（需要手动点击才展开），
 * 很容易被误认为「设计中心没有可用组件」。这里在模拟器渲染器就绪后自动展开，
 * 让组件目录直接可见。onSimulatorRendererReady 在已就绪时会立即回调，
 * 因此无论就绪发生在 init 期间还是之后都能覆盖。
 */
function autoOpenComponentsPane(engine: Window['AliLowCodeEngine']): void {
  const show = () => {
    try {
      engine.skeleton?.showPanel?.('componentsPane');
    } catch (error) {
      console.warn('[studio] 自动展开组件库面板失败', error);
    }
  };

  try {
    engine.project?.onSimulatorRendererReady?.(show);
  } catch (error) {
    console.warn('[studio] 监听模拟器就绪失败', error);
  }

  // 兜底：即便就绪事件已被更早消费，也尝试立即展开一次
  show();
}

/**
 * 启动设计器。插件必须在 init 之前注册（与官方 demo 的顺序一致）。
 */
export function initDesigner(
  container: HTMLElement,
  options: InitDesignerOptions = {},
): Promise<void> {
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    const engine = window.AliLowCodeEngine;
    if (!engine) {
      throw new Error(
        'lowcode-engine UMD 未加载。请先执行 pnpm vendor，并检查 index.html 中的 vendor 脚本。',
      );
    }

    await engine.plugins.register(DefaultSettersRegistryPlugin as never);
    registerComponentsPaneIcon(engine);
    await engine.plugins.register(ComponentsPanePlugin as never);
    await engine.plugins.register(UndoRedoPlugin as never);
    await engine.plugins.register(
      createAssetsPlugin(options.getInitialSchema ?? (() => createDefaultProjectSchema())) as never,
    );

    await engine.init(container, {
      locale: 'zh-CN',
      enableCondition: true,
      enableCanvasLock: true,
      enableContextMenu: true,
      // 数组顺序为 [样式, 脚本]，与引擎默认值一致
      simulatorUrl: [
        '/vendor/react-simulator-renderer.css',
        '/vendor/react-simulator-renderer.js',
      ],
    } as never);

    autoOpenComponentsPane(engine);
  })().catch((error) => {
    bootPromise = null;
    throw error;
  });

  return bootPromise;
}
