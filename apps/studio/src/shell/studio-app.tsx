import * as React from 'react';
import { ConfigProvider, Layout, Menu } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { currentPageId } from '../api.js';
import { ComponentCenter } from '../centers/component-center.js';
import { ArtifactCenter } from '../centers/artifact-center.js';
import { StudioHeader } from './studio-header.js';
import { LcDesigner } from '../designer/lc-designer.js';

export type CenterName = 'components' | 'designer' | 'artifacts';

function readCenter(): CenterName {
  const value = new URLSearchParams(window.location.search).get('center');
  return value === 'components' || value === 'artifacts' ? value : 'designer';
}

const NAV = [
  { key: 'components', label: '组件中心', hint: 'antd 表单与表格', index: '01' },
  { key: 'designer', label: '设计中心', hint: '拖拽编排页面', index: '02' },
  { key: 'artifacts', label: '产物中心', hint: '预览、渲染与发布', index: '03' },
] as const;

/** 顶部导航工作台外壳（React + antd）。 */
export function StudioApp(): React.ReactElement {
  const [center, setCenter] = React.useState<CenterName>(() => readCenter());
  // 避免在 display:none 下初始化 LowCode Engine，首次进入设计中心才挂载
  const [designerMounted, setDesignerMounted] = React.useState(() => readCenter() === 'designer');

  const navigate = React.useCallback((next: CenterName) => {
    const url = new URL(window.location.href);
    url.searchParams.set('center', next);
    window.history.pushState({ center: next }, '', url);
    if (next === 'designer') setDesignerMounted(true);
    setCenter(next);
    // 产物中心在挂载时已拉取一次，切换回来时再刷新，保证刚保存的页面立即出现
    if (next === 'artifacts') window.dispatchEvent(new CustomEvent('lc-refresh-artifacts'));
  }, []);

  React.useEffect(() => {
    const onPop = () => {
      const next = readCenter();
      if (next === 'designer') setDesignerMounted(true);
      setCenter(next);
      if (next === 'artifacts') window.dispatchEvent(new CustomEvent('lc-refresh-artifacts'));
    };
    const onOpenDesigner = (event: Event) => {
      const pageId = (event as CustomEvent<{ pageId?: string }>).detail?.pageId;
      if (pageId && pageId !== currentPageId()) {
        const url = new URL(window.location.href);
        url.searchParams.set('center', 'designer');
        url.searchParams.set('pageId', pageId);
        window.location.href = url.toString();
        return;
      }
      navigate('designer');
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('lc-open-designer', onOpenDesigner);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('lc-open-designer', onOpenDesigner);
    };
  }, [navigate]);

  return (
    <ConfigProvider locale={zhCN} button={{ autoInsertSpace: false }}>
      <Layout style={{ height: '100vh' }}>
        <Layout.Header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 36,
            height: 72,
            padding: '0 24px',
            lineHeight: 'normal',
            background: '#fff',
            borderBottom: '1px solid #e5e6eb',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto' }}>
            <span
              style={{
                width: 32, height: 32, borderRadius: 9, display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg,#165dff,#6b8cff)', color: '#fff',
                fontSize: 12, fontWeight: 800,
              }}
            >
              LC
            </span>
            <span>
              <strong style={{ display: 'block', fontSize: 13 }}>LowCode</strong>
              <small style={{ color: '#86909c', fontSize: 10 }}>antd Workbench</small>
            </span>
          </div>
          <Menu
            mode="horizontal"
            selectedKeys={[center]}
            style={{ flex: '1 1 auto', minWidth: 0, borderBottom: 'none', background: 'transparent' }}
            onSelect={({ key }) => navigate(key as CenterName)}
            items={NAV.map((item) => ({
              key: item.key,
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
                  <span style={{ color: '#c9cdd4', fontFamily: 'monospace', fontSize: 10 }}>
                    {item.index}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                    <strong style={{ fontSize: 13 }}>{item.label}</strong>
                    <small style={{ color: '#86909c', fontSize: 10 }}>{item.hint}</small>
                  </span>
                </span>
              ),
            }))}
          />
        </Layout.Header>
        <Layout.Content style={{ position: 'relative', minWidth: 0, minHeight: 0 }}>
          {center === 'components' ? (
            <div style={{ height: '100%', overflow: 'auto' }}>
              <ComponentCenter />
            </div>
          ) : null}
          {designerMounted ? (
            <div
              style={{
                display: center === 'designer' ? 'flex' : 'none',
                flexDirection: 'column',
                height: '100%',
              }}
            >
              <StudioHeader />
              <div style={{ flex: '1 1 auto', minHeight: 0, position: 'relative' }}>
                <LcDesigner />
              </div>
            </div>
          ) : null}
          {center === 'artifacts' ? (
            <div style={{ height: '100%', overflow: 'auto' }}>
              <ArtifactCenter />
            </div>
          ) : null}
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
}
