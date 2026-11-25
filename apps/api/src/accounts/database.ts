import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { ExtractionError } from '../extraction/errors.js';
import { readFileSync } from 'node:fs';
let client: PrismaClient | undefined;
export function poolConfiguration(connectionString: string, certificate = process.env.DATABASE_CA_CERT) {
  const url = new URL(connectionString);
  if (certificate) {
    // Hosted env holds PEM contents, never an inaccessible Mac file path. pg
    // otherwise lets sslmode in the URL overwrite an explicit ssl object.
    for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) url.searchParams.delete(key);
    return { connectionString: url.toString(), ssl: { ca: certificate.replaceAll('\\n', '\n'), rejectUnauthorized: true } };
  }
  if (process.env.NODE_ENV === 'production' && url.searchParams.has('sslrootcert')) {
    // Fail closed rather than silently discarding the configured trust root.
    try { readFileSync(url.searchParams.get('sslrootcert')!); } catch { throw new ExtractionError(503, 'storage_tls_unconfigured', 'Configure the database CA certificate on the backend before connecting.'); }
  }
  return { connectionString };
}
export function database() {
  if (!process.env.DATABASE_URL) throw new ExtractionError(503, 'storage_unconfigured', 'Saved work is not configured. Set DATABASE_URL privately and apply the migrations. Your temporary workspace still works.');
  return client ??= new PrismaClient({ adapter: new PrismaPg({ ...poolConfiguration(process.env.DATABASE_URL), max: process.env.NODE_ENV === 'production' ? 1 : 5, connectionTimeoutMillis: 5000, query_timeout: 10000 }, { schema: 'fuzl' }), log: [], errorFormat: 'minimal' });
}
