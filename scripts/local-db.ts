/**
 * Local PostgreSQL for development, no Docker needed (real Postgres binaries
 * from the `embedded-postgres` package). Data lives in .data/postgres.
 *
 *   npm run db:local        # keep this running in its own terminal
 *
 * Connection string (already in .env.example):
 *   postgres://postgres:postgres@localhost:5433/app
 *
 * Production uses Neon instead; see README.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const PORT = 5433;
const DATABASES = ["app", "app_test"];
const databaseDir = path.resolve(".data/postgres");

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
  onLog: () => {},
});

async function main() {
  if (!existsSync(path.join(databaseDir, "PG_VERSION"))) {
    console.log("Veritabanı ilk kez oluşturuluyor…");
    await pg.initialise();
  }
  await pg.start();

  const client = pg.getPgClient();
  await client.connect();
  for (const name of DATABASES) {
    const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [name]);
    if (!rowCount) await pg.createDatabase(name);
  }
  await client.end();

  console.log(`PostgreSQL çalışıyor: postgres://postgres:postgres@localhost:${PORT}/app`);
  console.log("Durdurmak için Ctrl+C.");

  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch(async (error) => {
  console.error(error);
  await pg.stop().catch(() => {});
  process.exit(1);
});
