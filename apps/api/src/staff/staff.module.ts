import { Module } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { StaffController } from "./staff.controller";
import { StaffService } from "./staff.service";

@Module({ imports: [AuthModule], controllers: [StaffController], providers: [StaffService, PrismaService] })
export class StaffModule {}

