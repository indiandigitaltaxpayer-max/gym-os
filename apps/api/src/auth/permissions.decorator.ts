import { SetMetadata } from "@nestjs/common";
import type { PermissionName } from "@gym/database";

export const REQUIRED_PERMISSIONS = "requiredPermissions";
export const RequirePermissions = (...permissions: PermissionName[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

