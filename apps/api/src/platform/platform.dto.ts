import { TenantStatus } from "@gym/database";
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from "class-validator";

export class PlatformLoginDto {
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() password!: string;
}

export class CreateTenantDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(60) slug!: string;
  @IsString() @MinLength(2) @MaxLength(100) branchName!: string;
  @IsString() @Length(2, 12) @Matches(/^[A-Za-z0-9_-]+$/) branchCode!: string;
  @IsOptional() @IsString() @MaxLength(240) branchAddress?: string;
  @IsString() @MinLength(2) @MaxLength(100) ownerName!: string;
  @IsEmail() ownerEmail!: string;
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]+$/) @MaxLength(40) subscriptionPlan?: string;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsString() @MaxLength(80) timezone?: string;
}

export class UpdateTenantDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]+$/) @MaxLength(40) subscriptionPlan?: string;
}

export class TenantListQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsEnum(TenantStatus) status?: TenantStatus;
}
