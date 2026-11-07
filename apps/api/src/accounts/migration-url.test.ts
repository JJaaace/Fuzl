import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrationDatabaseUrl } from './migration-url.js';

test('migration TLS translation requires encryption, strict identity verification and the same CA without changing credentials', () => {
  const runtime = new URL('postgresql://postgres.synthetic:p%40ss%23%25@synthetic.pooler.supabase.com:5432/postgres?sslmode=verify-full&sslaccept=accept_invalid_certs&schema=public&connect_timeout=5');
  runtime.searchParams.set('sslrootcert', '/local/config with spaces/root.crt');
  const before = runtime.toString();
  const cli = new URL(migrationDatabaseUrl(before));
  assert.equal(runtime.toString(), before, 'runtime pg configuration is unchanged');
  for (const key of ['protocol', 'username', 'password', 'hostname', 'port', 'pathname'] as const) assert.equal(cli[key], runtime[key]);
  assert.equal(cli.searchParams.get('sslmode'), 'require');
  assert.equal(cli.searchParams.get('sslaccept'), 'strict');
  assert.equal(cli.searchParams.get('sslcert'), runtime.searchParams.get('sslrootcert'));
  assert.equal(cli.searchParams.has('sslrootcert'), false);
  assert.equal(cli.searchParams.get('schema'), 'fuzl');
  assert.equal(cli.searchParams.get('connect_timeout'), '5');
});

test('strict migration TLS can use system trust without a custom certificate', () => {
  const cli = new URL(migrationDatabaseUrl('postgresql://synthetic:pass@db.example.invalid:5432/postgres?sslmode=verify-full'));
  assert.equal(cli.searchParams.get('sslmode'), 'require');
  assert.equal(cli.searchParams.get('sslaccept'), 'strict');
  assert.equal(cli.searchParams.has('sslcert'), false);
});

test('explicit direct migration connection takes precedence without changing the API pooler URL', () => {
  const runtime = 'postgresql://postgres.synthetic:synthetic-pass@pooler.example.invalid:5432/postgres?sslmode=verify-full';
  const direct = 'postgresql://postgres:synthetic-pass@db.example.invalid:5432/postgres?sslmode=verify-full&sslrootcert=%2Flocal%2Froot.crt';
  const cli = new URL(migrationDatabaseUrl(runtime, direct));
  assert.equal(cli.hostname, 'db.example.invalid');
  assert.equal(cli.username, 'postgres');
  assert.equal(cli.password, 'synthetic-pass');
  assert.equal(cli.searchParams.get('sslmode'), 'require');
  assert.equal(cli.searchParams.get('sslaccept'), 'strict');
  assert.equal(cli.searchParams.get('sslcert'), '/local/root.crt');
  assert.equal(new URL(migrationDatabaseUrl(runtime, '')).hostname, 'pooler.example.invalid');
  assert.equal(new URL(runtime).username, 'postgres.synthetic');
  assert.equal(new URL(migrationDatabaseUrl(undefined, direct)).hostname, 'db.example.invalid');
});

test('invalid selected direct URL fails without falling back to the pooler', () => {
  assert.throws(() => migrationDatabaseUrl('postgresql://test@127.0.0.1:5432/postgres', 'invalid-direct-secret'), /must be a PostgreSQL connection string/);
});

test('disposable local database and offline generation preserve their existing non-TLS setup', () => {
  const cli = new URL(migrationDatabaseUrl('postgresql://test@127.0.0.1:5432/postgres'));
  assert.equal(cli.searchParams.get('schema'), 'fuzl');
  assert.equal(cli.searchParams.has('sslmode'), false);
  assert.equal(new URL(migrationDatabaseUrl()).hostname, '127.0.0.1');
});

test('invalid database configuration reports a controlled error without echoing its input', () => {
  for (const input of ['private-invalid-credential', 'https://user:private-password@example.invalid']) {
    assert.throws(() => migrationDatabaseUrl(input), (error: unknown) => error instanceof Error && error.message === 'DATABASE_URL must be a PostgreSQL connection string.');
  }
});
