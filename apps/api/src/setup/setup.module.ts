import { Module } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { SetupController } from "./setup.controller";
import { SetupService } from "./setup.service";

@Module({ controllers: [SetupController], providers: [SetupService, PrismaService] })
export class SetupModule {}

