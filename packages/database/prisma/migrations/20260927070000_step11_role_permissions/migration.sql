UPDATE "Role"
SET "permissions" = ARRAY(
  SELECT DISTINCT permission
  FROM unnest("permissions" || ARRAY['report.operations.read', 'report.finance.read']::text[]) AS permission
)
WHERE "name" IN ('Owner', 'Manager');

UPDATE "Role"
SET "permissions" = ARRAY(
  SELECT DISTINCT permission
  FROM unnest("permissions" || ARRAY['report.operations.read']::text[]) AS permission
)
WHERE "name" = 'Front desk';

UPDATE "Role"
SET "permissions" = ARRAY(
  SELECT DISTINCT permission
  FROM unnest("permissions" || ARRAY['report.finance.read']::text[]) AS permission
)
WHERE "name" = 'Accountant';
