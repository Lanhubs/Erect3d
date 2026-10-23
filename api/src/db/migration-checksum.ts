import { digest } from '../security/tokens'
// Git may check SQL out with CRLF on Windows. Accept only equivalent line endings;
// SQL content changes must still fail, and historical checksum rows stay intact.
export function migrationChecksum(sql: string) {
  return digest(sql.replace(/\r\n/g, '\n'))
}
export function matchesMigrationChecksum(sql: string, stored: string) {
  const canonical = sql.replace(/\r\n/g, '\n')
  return stored === digest(canonical) || stored === digest(canonical.replace(/\n/g, '\r\n'))
}
