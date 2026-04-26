import { createApp } from './app.js';
import { initDb } from './db/index.js';
import { startHealthChecker } from './services/health.js';

const PORT = process.env.PORT ?? 3001;

async function main() {
  initDb();
  const app = createApp();

  app.listen(Number(PORT), '127.0.0.1', () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
    console.log(`Proxy endpoint: http://127.0.0.1:${PORT}/v1/chat/completions`);
    startHealthChecker();
  });
}

main().catch(console.error);
