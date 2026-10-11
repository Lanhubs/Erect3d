CREATE TABLE login_failures (
  key text PRIMARY KEY, failures integer NOT NULL, blocked_until timestamptz, updated_at timestamptz NOT NULL
);
CREATE INDEX login_failures_expiry ON login_failures(updated_at);
CREATE INDEX jobs_lease ON jobs(lease_expires_at) WHERE status='running';
CREATE INDEX assets_pending ON assets(created_at) WHERE state='pending';
CREATE INDEX library_scope ON library_items(project_id,team_id,id);
ALTER TABLE assets ADD CONSTRAINT asset_size_positive CHECK(size>0);
ALTER TABLE jobs ADD CONSTRAINT attempts_nonnegative CHECK(attempts>=0 AND max_attempts BETWEEN 1 AND 10);
ALTER TABLE snapshots ADD CONSTRAINT snapshot_revision_nonnegative CHECK(revision>=0);
ALTER TABLE operations ADD CONSTRAINT operation_revision_valid CHECK(revision>0 AND base_revision>=0);
ALTER TABLE projects ADD CONSTRAINT project_revision_nonnegative CHECK(revision>=0);
