import { CheckInSource } from "@gym/database";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

export class AttendanceMemberSearchQueryDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsString() branchId?: string;
}

export class ManualCheckInDto {
  @IsString() @IsNotEmpty() memberId!: string;
  @IsString() @IsNotEmpty() branchId!: string;
}

export class QrCheckInDto {
  @IsString() @IsNotEmpty() @MaxLength(300) token!: string;
  @IsString() @IsNotEmpty() branchId!: string;
}

export class ListAttendanceQueryDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsEnum(CheckInSource) source?: CheckInSource;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

export class AttendanceSummaryQueryDto {
  @IsString() @IsNotEmpty() branchId!: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}$/) month?: string;
}
