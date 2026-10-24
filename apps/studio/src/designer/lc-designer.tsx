import * as React from 'react';
import { loadInitialSchema } from '../api.js';
import { initDesigner } from './init-engine.js';

/**
 * 设计器宿主。lowcode-engine 依赖全局样式与普通 DOM 容器，
 * 因此这里用一个真实 div 承载引擎，React 只负责生命周期。
 */
export function LcDesigner(): React.ReactElement {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let cancelled = false;
    initDesigner(host, { getInitialSchema: loadInitialSchema })
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('[studio] designer init failed', err);
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div ref={hostRef} id="lce-designer" style={{ height: '100%' }} />
      {!ready && !error ? (
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#86909c', fontSize: 14, background: '#f7f8fa',
          }}
        >
          正在初始化设计器…
        </div>
      ) : null}
      {error ? (
        <div style={{ position: 'absolute', inset: 0, padding: 24, color: '#f53f3f', fontSize: 14, whiteSpace: 'pre-wrap', background: '#fff' }}>
          {`设计器初始化失败：\n${error}`}
        </div>
      ) : null}
    </div>
  );
}
