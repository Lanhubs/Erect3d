import {expect,test} from 'bun:test'
import {digest} from '../src/security/tokens'
import {migrationChecksum,matchesMigrationChecksum} from '../src/db/migration-checksum'
test('migration verification survives Git line ending conversion without accepting changed SQL',()=>{
  const lf='CREATE TABLE example (id text);\nCREATE INDEX example_id ON example(id);\n',crlf=lf.replace(/\n/g,'\r\n')
  expect(migrationChecksum(lf)).toBe(migrationChecksum(crlf))
  expect(matchesMigrationChecksum(crlf,digest(lf))).toBe(true)
  expect(matchesMigrationChecksum(lf,digest(crlf))).toBe(true)
  expect(matchesMigrationChecksum(lf.replace('id text','id integer'),digest(crlf))).toBe(false)
  expect(matchesMigrationChecksum(lf+'DROP TABLE example;\n',digest(lf))).toBe(false)
})
