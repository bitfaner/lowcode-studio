import { config } from './config.js';
import { closeDb, getDb } from './db.js';
import { buildServer } from './app.js';

const app = await buildServer();
getDb();

async function shutdown(signal: string): Promise<void> {
  app.log.info(`收到 ${signal}，正在关闭服务`);
  await app.close();
  closeDb();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: config.host, port: config.port });
  app.log.info(`Studio: http://${config.host}:${config.port}/`);
  app.log.info(`Runtime: http://${config.host}:${config.port}/runtime/`);
  app.log.info(`SQLite: ${config.dbFile}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
