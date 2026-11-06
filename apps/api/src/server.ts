import { app } from './app.js';

const configuredPort = process.env.PORT ?? '3001';
const port = Number(configuredPort);

if (!/^\d+$/.test(configuredPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535.');
  process.exit(1);
}

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Fuzl API listening at http://127.0.0.1:${port}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is occupied. Stop the other process or choose PORT and update the Vite proxy.`
    : `API startup failed: ${error.message}`);
  process.exit(1);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
