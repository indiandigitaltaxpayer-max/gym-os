export type AuthPrincipal = {
  userId: string;
  tenantId: string;
  sessionId: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  branchIds: string[];
};

