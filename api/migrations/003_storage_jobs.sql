CREATE TABLE assets (
  id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id), actor_id text NOT NULL REFERENCES users(id),
  object_key text NOT NULL UNIQUE, name text NOT NULL, mime text NOT NULL, size bigint NOT NULL,
  kind text NOT NULL CHECK(kind IN ('source','raster','thumbnail','export','screenshot','component')),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready','rejected','deleted')),
  sha256 text, metadata jsonb NOT NULL DEFAULT '{}', parent_id text REFERENCES assets(id),
  created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX assets_project ON assets(project_id,id) WHERE deleted_at IS NULL;
CREATE TABLE source_plans (
  project_id text NOT NULL REFERENCES projects(id), source_id text NOT NULL,
  original_asset_id text NOT NULL REFERENCES assets(id), raster_asset_id text REFERENCES assets(id),
  page integer, width integer, height integer, PRIMARY KEY(project_id,source_id)
);
CREATE TABLE jobs (
  id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id), actor_id text NOT NULL REFERENCES users(id),
  kind text NOT NULL, payload jsonb NOT NULL, request_id text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 3,
  available_at timestamptz NOT NULL DEFAULT now(), lease_owner text, lease_expires_at timestamptz,
  started_at timestamptz, completed_at timestamptz, failure_code text, result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_claim ON jobs(available_at,id) WHERE status IN ('queued','running');
CREATE INDEX jobs_project ON jobs(project_id,id);
CREATE TABLE analyses (
  id text PRIMARY KEY REFERENCES jobs(id), project_id text NOT NULL REFERENCES projects(id),
  source_asset_id text NOT NULL REFERENCES assets(id), source_hash text NOT NULL,
  cache_key text NOT NULL, model text NOT NULL, prompt_version integer NOT NULL, schema_version integer NOT NULL,
  options jsonb NOT NULL, status text NOT NULL DEFAULT 'pending', result jsonb,
  accepted_revision bigint, reviewed_by text REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analyses_cache ON analyses(project_id,cache_key,created_at DESC);
CREATE TABLE ai_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id text NOT NULL REFERENCES users(id),
  team_id text REFERENCES teams(id), project_id text NOT NULL REFERENCES projects(id), job_id text NOT NULL REFERENCES jobs(id),
  model text NOT NULL, kind text NOT NULL, tokens jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_daily ON ai_usage(actor_id,created_at);
