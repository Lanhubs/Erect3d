import type { Database } from '../../db/connection'

export async function readOperations(db: Database, projectId: string, after: number, limit: number, through: number) {
  // Bound both count and serialized payload bytes; a long history must not allocate hundreds of MiB.
  return db`WITH batch AS (
    SELECT operation_id AS "operationId",base_revision AS "baseRevision",revision,type,
      entity_id AS "entityId",actor_id AS "actorId",payload FROM operations
    WHERE project_id=${projectId} AND revision>${after} AND revision<=${through} ORDER BY revision LIMIT ${limit}
  ), sized AS (
    SELECT *,sum(octet_length(payload::text)) OVER (ORDER BY revision) AS bytes,row_number() OVER (ORDER BY revision) AS position FROM batch
  ) SELECT "operationId","baseRevision",revision,type,"entityId","actorId",payload FROM sized
    WHERE bytes<=2097152 OR position=1 ORDER BY revision`
}
