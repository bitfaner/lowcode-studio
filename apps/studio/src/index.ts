import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { StudioApp } from './shell/studio-app.js';

const container = document.getElementById('app');
if (container) {
  // 清掉 index.html 里的静态占位（若存在）
  container.textContent = '';
  createRoot(container).render(React.createElement(StudioApp));
}
