-- Existing approvals remain immutable; NULL means their revision was not recorded by the older schema.
ALTER TABLE approvals ADD COLUMN project_revision bigint CHECK (project_revision >= 0);
