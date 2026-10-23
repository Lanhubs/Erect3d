import { connect } from '../src/db/connection'
import { readConfig } from '../src/config/env'
import { migrationChecksum, matchesMigrationChecksum } from '../src/db/migration-checksum'
import { fileURLToPath } from 'node:url'
const db = connect(readConfig())
try {
  await db.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(71330427)`
    await tx`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`
    const names = [
      ...new Bun.Glob('*.sql').scanSync(fileURLToPath(new URL('../migrations', import.meta.url))),
    ].sort()
    for (const name of names) {
      const sql = await Bun.file(new URL(`../migrations/${name}`, import.meta.url)).text()
      const hash = migrationChecksum(sql)
      const [existing] = await tx`SELECT checksum FROM schema_migrations WHERE name=${name}`
      if (existing) {
        if (!matchesMigrationChecksum(sql, existing.checksum))
          throw new Error(`Applied migration changed: ${name}`)
        continue
      }
      await tx.unsafe(sql).simple()
      await tx`INSERT INTO schema_migrations(name,checksum) VALUES (${name},${hash})`
      console.log(`Applied ${name}`)
    }
  })
} finally {
  await db.close()
}
