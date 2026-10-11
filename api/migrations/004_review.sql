CREATE TABLE comments (
  id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id), actor_id text NOT NULL REFERENCES users(id),
  parent_id text REFERENCES comments(id), text text NOT NULL, anchor jsonb NOT NULL,
  resolved_at timestamptz, resolved_by text REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_project ON comments(project_id,id);
CREATE TABLE issues (
  id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id), actor_id text NOT NULL REFERENCES users(id),
  title text NOT NULL, description text NOT NULL, anchor jsonb NOT NULL, assignee_id text REFERENCES users(id),
  status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(), modified_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX issues_project ON issues(project_id,id);
CREATE TABLE approvals (
  id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id), actor_id text NOT NULL REFERENCES users(id),
  version_id text REFERENCES versions(id), level_id text, presentation_id text,
  decision text NOT NULL CHECK(decision IN ('APPROVED','CHANGES_REQUESTED')), note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE shares (
  id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id), actor_id text NOT NULL REFERENCES users(id),
  token_hash text NOT NULL UNIQUE, scope text NOT NULL CHECK(scope IN ('VIEW','COMMENT','APPROVE')),
  version_id text REFERENCES versions(id), expires_at timestamptz NOT NULL, revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE saved_views (
  id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id), actor_id text NOT NULL REFERENCES users(id),
  name text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE presentations (
  id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id), actor_id text NOT NULL REFERENCES users(id),
  name text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE approvals ADD CONSTRAINT approvals_presentation FOREIGN KEY(presentation_id) REFERENCES presentations(id);
CREATE TABLE library_items (
  id text PRIMARY KEY, owner_id text REFERENCES users(id), team_id text REFERENCES teams(id),
  project_id text REFERENCES projects(id), kind text NOT NULL CHECK(kind IN ('material','component')),
  name text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(owner_id IS NOT NULL OR team_id IS NULL AND project_id IS NULL)
);
