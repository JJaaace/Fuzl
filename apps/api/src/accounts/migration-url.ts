// Prisma's native migration engine and the API's pg driver use different TLS
// parameters. Keep DATABASE_URL in pg/libpq format; translate only for the CLI.
export function migrationDatabaseUrl(value?: string, directValue?: string): string {
  let url: URL;
  try { url = new URL(directValue || value || 'postgresql://unconfigured@127.0.0.1:1/unconfigured'); }
  catch { throw new Error('DATABASE_URL must be a PostgreSQL connection string.'); }
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) throw new Error('DATABASE_URL must be a PostgreSQL connection string.');
  url.searchParams.set('schema', 'fuzl');
  if (url.searchParams.get('sslmode') === 'verify-full') {
    // Prisma 7.10's native connector recognizes require/prefer/disable, not
    // verify-full. strict keeps certificate AND hostname validation enabled.
    const certificate = url.searchParams.get('sslrootcert');
    url.searchParams.delete('sslrootcert');
    url.searchParams.set('sslmode', 'require');
    url.searchParams.set('sslaccept', 'strict');
    if (certificate) url.searchParams.set('sslcert', certificate);
  }
  return url.toString();
}
