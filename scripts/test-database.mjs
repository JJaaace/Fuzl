// Creates and destroys its OWN disposable cluster. Both connection variables
// are overridden so inherited settings or Prisma's .env cannot select a real DB.
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
const root = await mkdtemp(join(tmpdir(), 'fuzl-db-test-'));
const data = join(root, 'data'); const socket = join(root, 'socket'); await mkdir(socket);
const probe = createServer(); await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve)); const port = probe.address().port; await new Promise((resolve) => probe.close(resolve));
const username = userInfo().username;
const url = `postgresql://${encodeURIComponent(username)}@127.0.0.1:${port}/postgres`;
function run(cmd, args, env = process.env, quiet = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env, stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
    if (quiet) { child.stdout.resume(); child.stderr.resume(); }
    child.once('error', reject); child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(quiet ? `Disposable database command failed: ${cmd}` : `${cmd} exited ${code}`)));
  });
}
let started = false;
try {
  await run('initdb', ['-D', data, '-A', 'trust', '--no-instructions', '--encoding=UTF8', '--locale=C'], process.env, true);
  await run('pg_ctl', ['-D', data, '-l', join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${socket}`, '-w', 'start'], process.env, true); started = true;
  await run('psql', [url, '-v', 'ON_ERROR_STOP=1', '-c', 'CREATE ROLE anon; CREATE ROLE authenticated; CREATE TABLE public.unrelated_existing_data (id int PRIMARY KEY); INSERT INTO public.unrelated_existing_data VALUES (1);'], process.env, true);
  const environment = { ...process.env, DATABASE_URL: url, DIRECT_URL: url, FUZL_TEST_DATABASE_URL: url, FUZL_DISPOSABLE_DATABASE: 'owned-by-test-runner' };
  await run('npm', ['run', 'db:migrate'], environment);
  await run('npm', ['run', 'db:migrate'], environment); // Applying the migration twice must preserve data/schema.
  await run('node', ['--import', 'tsx', '--test', 'apps/api/src/accounts/database.integration.test.ts', 'apps/api/src/guests/database.integration.test.ts', 'apps/api/src/places/database.integration.test.ts', 'apps/api/src/events/database.integration.test.ts'], environment);
} catch (error) { console.error(error instanceof Error ? error.message : 'Disposable database verification failed.'); process.exitCode = 1; }
finally {
  if (started) await run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'], process.env, true);
  await rm(root, { recursive: true, force: true }); console.log('Disposable PostgreSQL cluster stopped and removed.');
}
