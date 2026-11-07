if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL privately in apps/api/.env before running migrations. Do not paste it into chat. No database was contacted.');
  process.exit(1);
}
