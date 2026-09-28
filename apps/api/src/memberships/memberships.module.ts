import { Module } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { BillingModule } from "../billing/billing.module";
import { MembershipsController } from "./memberships.controller";
import { MembershipsService } from "./memberships.service";

@Module({ imports: [BillingModule], controllers: [MembershipsController], providers: [MembershipsService, PrismaService] })
export class MembershipsModule {}
