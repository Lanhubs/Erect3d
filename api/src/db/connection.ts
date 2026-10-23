import { SQL } from 'bun'
import { readFileSync } from 'node:fs'
import type { Config } from '../config/env'
export type Database = SQL
export function connect(config: Config) {
  return new SQL(config.DATABASE_URL, {
    max: config.DB_POOL_SIZE,
    idleTimeout: 30,
    connectionTimeout: 10,
    tls:
      config.DATABASE_TLS === 'verify-full'
        ? {
            rejectUnauthorized: true,
            serverName: config.DATABASE_SERVER_NAME || new URL(config.DATABASE_URL).hostname,
            ...(config.DATABASE_CA_FILE ? { ca: readFileSync(config.DATABASE_CA_FILE, 'utf8') } : {}),
          }
        : false,
    onconnect: () => {},
    onclose: () => {},
  })
}
