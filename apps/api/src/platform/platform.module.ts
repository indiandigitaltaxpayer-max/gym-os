import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaService } from "../common/prisma.service";
import { PlatformAuditController, PlatformAuthController, PlatformTenantsController } from "./platform.controller";
import { PlatformAuthService } from "./platform-auth.service";
import { PlatformService } from "./platform.service";

@Module({
  imports: [AuthModule],
  controllers: [PlatformAuthController, PlatformTenantsController, PlatformAuditController],
  providers: [PlatformAuthService, PlatformService, PrismaService],
  exports: [PlatformAuthService],
})
export class PlatformModule {}
