ALTER TABLE "StaffInvitation"
ADD CONSTRAINT "StaffInvitation_exactly_one_inviter_check"
CHECK (
  ("invitedById" IS NOT NULL AND "invitedByPlatformAdminId" IS NULL)
  OR
  ("invitedById" IS NULL AND "invitedByPlatformAdminId" IS NOT NULL)
);
