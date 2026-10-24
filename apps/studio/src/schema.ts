import type { PageType, ProjectSchema } from '@lc/schema';

export function createDefaultProjectSchema(
  title = '未命名页面',
  pageType: PageType = 'list',
): ProjectSchema {
  return {
    version: '1.0.0',
    componentsTree: [
      {
        componentName: 'Page',
        props: {
          title,
          pageType,
        },
        children: [],
      },
    ],
    componentsMap: [
      {
        componentName: 'Page',
        package: 'lc-materials',
        version: '0.1.0',
        exportName: 'Page',
      },
    ],
    dataSource: {},
    config: {},
  };
}
