ALTER TABLE source_plans ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX source_plans_created ON source_plans(created_at);
