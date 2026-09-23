import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

/**
 * Brings a database's schema up to date. Safe on every boot: drizzle records applied
 * migrations, so a deploy with nothing new is a no-op. The SQL ships in the package's
 * `drizzle/` folder, beside `dist/`.
 */
export async function runMigrations(url: string): Promise<void> {
  const folder = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle')
  const sql = postgres(url, { max: 1, onnotice: () => {} })
  try {
    await migrate(drizzle(sql), { migrationsFolder: folder })
  } finally {
    await sql.end()
  }
}
