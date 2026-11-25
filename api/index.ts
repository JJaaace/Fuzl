// Vercel Node function: frontend and API use one HTTPS origin. No local listener.
import { app } from '../apps/api/src/app.js';
export default app;
