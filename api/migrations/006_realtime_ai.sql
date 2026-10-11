CREATE FUNCTION notify_realtime() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM pg_notify('erect_events', NEW.id::text); RETURN NEW; END $$;
CREATE TRIGGER realtime_notify AFTER INSERT ON realtime_events FOR EACH ROW EXECUTE FUNCTION notify_realtime();
CREATE FUNCTION notify_presence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM pg_notify('erect_presence', NEW.id::text); RETURN NEW; END $$;
CREATE TRIGGER presence_notify AFTER INSERT ON presence_events FOR EACH ROW EXECUTE FUNCTION notify_presence();
CREATE TABLE websocket_connections (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), project_id text NOT NULL REFERENCES projects(id),
  instance_id text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX websocket_user ON websocket_connections(user_id,expires_at);
CREATE TABLE analysis_passes (
  analysis_id text NOT NULL REFERENCES analyses(id), pass text NOT NULL, proposal jsonb NOT NULL,
  usage jsonb, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(analysis_id,pass)
);
CREATE TABLE ai_calls (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, analysis_id text NOT NULL REFERENCES analyses(id),
  actor_id text NOT NULL REFERENCES users(id), model text NOT NULL, pass text NOT NULL,
  usage jsonb, failure_code text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_calls_user ON ai_calls(actor_id,created_at);
ALTER TABLE analyses ADD COLUMN review_operation_id text;
ALTER TABLE analyses ADD COLUMN review_hash text;
