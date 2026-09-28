import { Type } from "class-transformer";
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CreateMembershipPlanDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsInt() @Min(1) @Max(3650) durationDays!: number;
  @IsInt() @Min(0) priceMinor!: number;
  @IsOptional() @IsInt() @Min(0) @Max(10000) taxRateBps?: number;
}

export class UpdateMembershipPlanDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsInt() @Min(1) @Max(3650) durationDays?: number;
  @IsOptional() @IsInt() @Min(0) priceMinor?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10000) taxRateBps?: number;
}

export class AssignMembershipDto {
  @IsString() @IsNotEmpty() memberId!: string;
  @IsString() @IsNotEmpty() planId!: string;
  @IsDateString() startsAt!: string;
  @IsOptional() @IsDateString() dueAt?: string;
}

export class RenewMembershipDto {
  @IsOptional() @IsString() @IsNotEmpty() planId?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}

export class MembershipReasonDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ExpiringMembershipsQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(90) days = 30;
  @IsOptional() @IsString() branchId?: string;
}
