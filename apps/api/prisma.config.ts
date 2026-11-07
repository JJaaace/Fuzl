import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { migrationDatabaseUrl } from './src/accounts/migration-url.js';
export default defineConfig({
  schema: 'prisma/schema.prisma', migrations: { path: 'prisma/migrations' },
  // Generation requires no connection; runtime never uses this placeholder.
  datasource: { url: migrationDatabaseUrl(process.env.DATABASE_URL, process.env.DIRECT_URL) },
});
