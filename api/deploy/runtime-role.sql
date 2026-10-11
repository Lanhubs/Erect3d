-- Run as the migration/administration role after migrations. Create the login
-- role and its secret separately through your operator's secret manager.
GRANT CONNECT ON DATABASE erect3d TO erect_app;
GRANT USAGE ON SCHEMA public TO erect_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO erect_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO erect_app;
REVOKE UPDATE,DELETE,TRUNCATE ON audit_events,versions,approvals,operations,snapshots FROM erect_app;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON schema_migrations FROM erect_app;
REVOKE CREATE ON SCHEMA public FROM erect_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
