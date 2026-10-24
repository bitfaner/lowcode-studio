import * as React from 'react';

/**
 * 组件库 dock 使用内联 SVG，避免 NextIcon 远程字体不可用时入口只剩空白。
 */
export function ComponentsPaneIcon(): React.ReactElement {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 20 20"
      width="20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="2.25" y="2.25" width="6.5" height="6.5" rx="1.5"
        stroke="currentColor" strokeWidth="1.5"
      />
      <rect
        x="11.25" y="2.25" width="6.5" height="6.5" rx="1.5"
        stroke="currentColor" strokeWidth="1.5"
      />
      <rect
        x="2.25" y="11.25" width="6.5" height="6.5" rx="1.5"
        stroke="currentColor" strokeWidth="1.5"
      />
      <path
        d="M14.5 11.25V17.75M11.25 14.5H17.75"
        stroke="currentColor" strokeLinecap="round" strokeWidth="1.5"
      />
    </svg>
  );
}
