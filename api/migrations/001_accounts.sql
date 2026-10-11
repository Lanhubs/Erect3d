CREATE TABLE users (
  id text PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL,
  password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE, csrf_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL, idle_expires_at timestamptz NOT NULL,
  revoked_at timestamptz, device text NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE teams (
  id text PRIMARY KEY, name text NOT NULL, owner_id text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE team_members (
  team_id text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id), role text NOT NULL CHECK(role IN ('OWNER','EDITOR','REVIEWER','CLIENT','VIEWER')),
  PRIMARY KEY(team_id,user_id)
);
CREATE TABLE projects (
  id text PRIMARY KEY, owner_id text NOT NULL REFERENCES users(id),
  team_id text REFERENCES teams(id), name text NOT NULL, revision bigint NOT NULL DEFAULT 0,
  allow_client_approval boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), modified_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX projects_owner ON projects(owner_id,id) WHERE deleted_at IS NULL;
CREATE INDEX projects_team ON projects(team_id,id) WHERE deleted_at IS NULL;
CREATE TABLE project_members (
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id), role text NOT NULL CHECK(role IN ('OWNER','EDITOR','REVIEWER','CLIENT','VIEWER')),
  PRIMARY KEY(project_id,user_id)
);
CREATE TABLE invitations (
  id text PRIMARY KEY, team_id text NOT NULL REFERENCES teams(id), invited_by text NOT NULL REFERENCES users(id),
  email text NOT NULL, role text NOT NULL CHECK(role IN ('EDITOR','REVIEWER','CLIENT','VIEWER')),
  token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, accepted_at timestamptz, revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id text REFERENCES users(id),
  project_id text REFERENCES projects(id), event text NOT NULL, request_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_project ON audit_events(project_id,id);
CREATE FUNCTION immutable_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit events are append only'; END $$;
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION immutable_audit();
CREATE TABLE idempotency_keys (
  actor_id text NOT NULL REFERENCES users(id), scope text NOT NULL, key text NOT NULL,
  request_hash text NOT NULL, response jsonb NOT NULL, expires_at timestamptz NOT NULL,
  PRIMARY KEY(actor_id,scope,key)
);
CREATE TABLE rate_windows (
  key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL
);
