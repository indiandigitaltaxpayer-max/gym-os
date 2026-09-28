import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PrismaService } from "./common/prisma.service";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { PermissionsGuard } from "./auth/permissions.guard";
import { AuthModule } from "./auth/auth.module";
import { StaffModule } from "./staff/staff.module";
import { AppController } from "./app.controller";
import { SetupModule } from "./setup/setup.module";
import { OperationsModule } from "./operations/operations.module";
import { MembersModule } from "./members/members.module";
import { MembershipsModule } from "./memberships/memberships.module";
import { BillingModule } from "./billing/billing.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { LeadsModule } from "./leads/leads.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { ReportsModule } from "./reports/reports.module";

@Module({
  imports: [AuthModule, StaffModule, SetupModule, MembersModule, BillingModule, MembershipsModule, AttendanceModule, LeadsModule, NotificationsModule, ReportsModule, OperationsModule],
  controllers: [AppController],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
