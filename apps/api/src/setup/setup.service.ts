import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { CreateBranchDto, CreatePlanDto } from "./setup.dto";
import type { AuthPrincipal } from "../auth/auth.types";
import { RoleName } from "@gym/database";

@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  async getSetup(principal: AuthPrincipal): Promise<unknown> {
    return this.prisma.tenant.findFirstOrThrow({
      where: { id: principal.tenantId },
      select: { id: true, name: true, slug: true, currency: true, branches: { where: principal.roles.includes(RoleName.OWNER) ? {} : { id: { in: principal.branchIds } } }, plans: true },
    });
  }

  async createBranch(tenantId: string, dto: CreateBranchDto): Promise<unknown> {
    return this.prisma.branch.create({ data: { tenantId, ...dto } });
  }

  async createPlan(tenantId: string, dto: CreatePlanDto): Promise<unknown> {
    return this.prisma.membershipPlan.create({
      data: { tenantId, ...dto, taxRateBps: dto.taxRateBps ?? 0 },
    });
  }
}
