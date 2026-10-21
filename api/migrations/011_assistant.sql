CREATE TABLE assistant_threads (
  id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id), actor_id text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id,actor_id)
);
CREATE TABLE assistant_runs (
  id text PRIMARY KEY REFERENCES jobs(id), thread_id text NOT NULL REFERENCES assistant_threads(id),
  project_id text NOT NULL REFERENCES projects(id), actor_id text NOT NULL REFERENCES users(id),
  base_revision bigint NOT NULL, scope jsonb NOT NULL, plan_source_ids jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','clarification','ready','applied','cancelled','failed','stale','discarded')),
  progress text NOT NULL DEFAULT 'Waiting to start', proposal jsonb, summary text, failure_code text,
  usage jsonb, applied_operation_id text, applied_revision bigint, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_runs_owner ON assistant_runs(project_id,actor_id,created_at DESC);
CREATE UNIQUE INDEX assistant_one_pending ON assistant_runs(thread_id) WHERE status IN ('queued','running');
CREATE TABLE assistant_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, thread_id text NOT NULL REFERENCES assistant_threads(id),
  run_id text REFERENCES assistant_runs(id), role text NOT NULL CHECK(role IN ('user','assistant')),
  content text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_messages_thread ON assistant_messages(thread_id,id DESC);
ALTER TABLE realtime_events ADD COLUMN recipient_user_id text REFERENCES users(id);
