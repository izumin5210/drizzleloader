import { execFileSync } from "node:child_process";
import postgres from "postgres";

export interface TestDbContext {
  dbName: string;
  connectionString: string;
}

const getAdminConnectionString = (): string => {
  return (
    process.env.POSTGRES_URL ?? "postgres://postgres@localhost:5432/postgres"
  );
};

function generateTimestamp(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
    pad(now.getMilliseconds(), 3),
  ].join("");
}

export async function createTestDatabase(): Promise<TestDbContext> {
  const adminUrl = getAdminConnectionString();
  const adminClient = postgres(adminUrl, { max: 1 });

  const dbName = `drizzleloader_test_${generateTimestamp()}`;

  await adminClient.unsafe(`CREATE DATABASE "${dbName}"`);
  await adminClient.end();

  const parsed = new URL(adminUrl);
  parsed.pathname = `/${dbName}`;
  const connectionString = parsed.toString();

  return { dbName, connectionString };
}

export async function dropTestDatabase(ctx: TestDbContext): Promise<void> {
  const adminUrl = getAdminConnectionString();
  const adminClient = postgres(adminUrl, { max: 1 });

  // Terminate existing connections
  await adminClient`
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = ${ctx.dbName}
      AND pid <> pg_backend_pid()
  `;

  await adminClient.unsafe(`DROP DATABASE IF EXISTS "${ctx.dbName}"`);
  await adminClient.end();
}

/**
 * Push Drizzle schema to the test database using drizzle-kit push.
 * This eliminates the need to manually write CREATE TABLE statements.
 */
export function pushSchemaToDatabase(
  ctx: TestDbContext,
  schemaPath: string,
): void {
  execFileSync(
    "pnpm",
    [
      "drizzle-kit",
      "push",
      "--dialect=postgresql",
      `--schema=${schemaPath}`,
      `--url=${ctx.connectionString}`,
      "--force",
    ],
    {
      stdio: "pipe",
      cwd: process.cwd(),
    },
  );
}
