import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { ExtractionError } from '../extraction/errors.js';
let client: PrismaClient | undefined;
export function database() {
  if (!process.env.DATABASE_URL) throw new ExtractionError(503, 'storage_unconfigured', 'Saved work is not configured. Set DATABASE_URL privately and apply the migrations. Your temporary workspace still works.');
  return client ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000, query_timeout: 10000 }, { schema: 'fuzl' }), log: [], errorFormat: 'minimal' });
}
