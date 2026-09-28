UPDATE "Role"
SET "permissions" = ARRAY(
  SELECT DISTINCT permission
  FROM unnest("permissions" || ARRAY['notification.read', 'notification.manage']::text[]) AS permission
)
WHERE "name" IN ('Owner', 'Manager');

UPDATE "Role"
SET "permissions" = ARRAY(
  SELECT DISTINCT permission
  FROM unnest("permissions" || ARRAY['notification.read']::text[]) AS permission
)
WHERE "name" = 'Front desk';
