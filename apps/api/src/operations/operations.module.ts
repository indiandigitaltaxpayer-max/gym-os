import { Module } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { OperationsController } from "./operations.controller";
import { OperationsService } from "./operations.service";
import { AttendanceModule } from "../attendance/attendance.module";

@Module({ imports: [AttendanceModule], controllers: [OperationsController], providers: [OperationsService, PrismaService] })
export class OperationsModule {}
