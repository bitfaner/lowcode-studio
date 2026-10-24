import { fileURLToPath } from 'node:url';

/** 默认路径基于本文件位置，避免从不同工作目录启动时数据/静态目录漂移 */
export const config = {
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 3000),
  dbFile: process.env.DB_FILE ?? fileURLToPath(new URL('../data/lowcode.db', import.meta.url)),
  /** 设置后，所有写接口需要 Bearer Token */
  studioToken: process.env.STUDIO_TOKEN ?? '',
  /** 开发环境允许代理到内网地址（例如本地 mock 服务） */
  allowPrivateDatasource: process.env.ALLOW_PRIVATE_DATASOURCE === '1',
  datasourceAllowedHosts: (process.env.DATASOURCE_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean),
  /** 上游数据源响应体上限 */
  datasourceMaxBytes: Number(process.env.DATASOURCE_MAX_BYTES ?? 5 * 1024 * 1024),
  studioDir: process.env.STUDIO_DIR ?? fileURLToPath(new URL('../../studio/dist', import.meta.url)),
  runtimeDir: process.env.RUNTIME_DIR ?? fileURLToPath(new URL('../../runtime/dist', import.meta.url)),
};
