import express from 'express';

export const app = express();
app.disable('x-powered-by');

app.get('/api/health', (_request, response) => {
  response.set('Cache-Control', 'no-store');
  response.json({ status: 'ok', service: 'fuzl-api' });
});
