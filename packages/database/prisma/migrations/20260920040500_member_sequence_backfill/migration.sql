UPDATE "Tenant" AS tenant
SET "memberSequence" = member_counts.count
FROM (
  SELECT "tenantId", COUNT(*)::INTEGER AS count
  FROM "Member"
  GROUP BY "tenantId"
) AS member_counts
WHERE tenant.id = member_counts."tenantId";
