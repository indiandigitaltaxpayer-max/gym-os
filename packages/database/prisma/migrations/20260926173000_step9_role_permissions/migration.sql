UPDATE "Role"
SET "permissions" = ARRAY(
  SELECT DISTINCT permission
  FROM unnest("permissions" || ARRAY['lead.read', 'lead.write', 'lead.convert']::text[]) AS permission
)
WHERE "name" IN ('Owner', 'Manager', 'Front desk');
