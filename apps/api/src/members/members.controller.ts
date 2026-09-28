import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Permission } from "@gym/database";
import type { Request } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequirePermissions } from "../auth/permissions.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { AddMemberNoteDto, CreateMemberDto, ListMembersQueryDto, UpdateMemberDto } from "./members.dto";
import { MembersService } from "./members.service";

@Controller("members")
export class MembersController {
  constructor(private readonly service: MembersService) {}

  @Get()
  @RequirePermissions(Permission.MEMBER_READ)
  list(@CurrentUser() principal: AuthPrincipal, @Query() query: ListMembersQueryDto) {
    return this.service.list(principal, query);
  }

  @Post()
  @RequirePermissions(Permission.MEMBER_WRITE)
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateMemberDto, @Req() request: Request) {
    return this.service.create(principal, dto, request.ip);
  }

  @Get(":memberId")
  @RequirePermissions(Permission.MEMBER_READ)
  detail(@CurrentUser() principal: AuthPrincipal, @Param("memberId") memberId: string) {
    return this.service.detail(principal, memberId);
  }

  @Patch(":memberId")
  @RequirePermissions(Permission.MEMBER_WRITE)
  update(@CurrentUser() principal: AuthPrincipal, @Param("memberId") memberId: string, @Body() dto: UpdateMemberDto, @Req() request: Request) {
    return this.service.update(principal, memberId, dto, request.ip);
  }

  @Post(":memberId/notes")
  @RequirePermissions(Permission.MEMBER_WRITE)
  addNote(@CurrentUser() principal: AuthPrincipal, @Param("memberId") memberId: string, @Body() dto: AddMemberNoteDto, @Req() request: Request) {
    return this.service.addNote(principal, memberId, dto, request.ip);
  }

  @Post(":memberId/archive")
  @RequirePermissions(Permission.MEMBER_WRITE)
  archive(@CurrentUser() principal: AuthPrincipal, @Param("memberId") memberId: string, @Req() request: Request) {
    return this.service.archive(principal, memberId, request.ip);
  }

  @Post(":memberId/reactivate")
  @RequirePermissions(Permission.MEMBER_WRITE)
  reactivate(@CurrentUser() principal: AuthPrincipal, @Param("memberId") memberId: string, @Req() request: Request) {
    return this.service.reactivate(principal, memberId, request.ip);
  }
}
