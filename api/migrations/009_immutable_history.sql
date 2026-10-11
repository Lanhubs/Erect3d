CREATE TRIGGER operations_immutable BEFORE UPDATE OR DELETE ON operations
  FOR EACH ROW EXECUTE FUNCTION immutable_audit();
CREATE TRIGGER snapshots_immutable BEFORE UPDATE OR DELETE ON snapshots
  FOR EACH ROW EXECUTE FUNCTION immutable_audit();
