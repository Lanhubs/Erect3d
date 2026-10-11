ALTER TABLE issues ADD COLUMN priority text NOT NULL DEFAULT 'MEDIUM'
  CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL'));
ALTER TABLE issues ADD COLUMN resolved_at timestamptz;
ALTER TABLE issues ADD COLUMN comment_id text REFERENCES comments(id);
