import type * as ReactNS from 'react';
import type * as EngineNS from '@alilc/lowcode-engine';

declare global {
  interface Window {
    React: typeof ReactNS;
    ReactDOM: typeof import('react-dom');
    AliLowCodeEngine: typeof EngineNS;
    AliLowCodeEngineExt: any;
    Next: any;
  }
}

export {};
