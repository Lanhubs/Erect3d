CREATE TABLE snapshots (
  project_id text NOT NULL REFERENCES projects(id), revision bigint NOT NULL,
  schema_version integer NOT NULL, document jsonb NOT NULL, checksum text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(project_id,revision)
);
CREATE TABLE operations (
  project_id text NOT NULL REFERENCES projects(id), revision bigint NOT NULL, operation_id text NOT NULL,
  actor_id text NOT NULL REFERENCES users(id), base_revision bigint NOT NULL,
  type text NOT NULL, entity_id text NOT NULL, payload jsonb NOT NULL, request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(project_id,revision), UNIQUE(project_id,operation_id)
);
CREATE INDEX operations_entity ON operations(project_id,entity_id,revision);
CREATE TABLE versions (
  id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id), revision bigint NOT NULL,
  name text NOT NULL, actor_id text NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(project_id,revision) REFERENCES snapshots(project_id,revision)
);
CREATE INDEX versions_project ON versions(project_id,id);
CREATE TABLE realtime_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id),
  type text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX realtime_project ON realtime_events(project_id,id);
CREATE TABLE entity_locks (
  project_id text NOT NULL REFERENCES projects(id), entity_id text NOT NULL,
  user_id text NOT NULL REFERENCES users(id), connection_id text NOT NULL,
  expires_at timestamptz NOT NULL, PRIMARY KEY(project_id,entity_id)
);
CREATE TABLE presence_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id),
  user_id text NOT NULL REFERENCES users(id), connection_id text NOT NULL,
  payload jsonb NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX presence_poll ON presence_events(id);
