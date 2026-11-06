import { createServer } from 'node:net';

// Watch runners stay alive after a child exits. Fail before watching when the
// port is unusable so the root runner can stop the other development server.
const configuredPort = process.env.PORT ?? '3001';
const port = Number(configuredPort);
if (!/^\d+$/.test(configuredPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535.');
  process.exit(1);
}

const probe = createServer();
probe.once('error', (error) => {
  console.error(`Cannot start API on port ${port}: ${error.message}. Stop the other process or choose PORT and update the Vite proxy.`);
  process.exit(1);
});
probe.listen(port, '127.0.0.1', () => probe.close());
