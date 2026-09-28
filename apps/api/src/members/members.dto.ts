import { Transform, Type } from "class-transformer";
import { Gender, MemberStatus } from "@gym/database";
import {
  IsDateString,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const optionalNumber = ({ value }: { value: unknown }) =>
  value === "" || value === null || value === undefined ? null : Number(value);

export class CreateMemberDto {
  @IsString() @IsNotEmpty() branchId!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) firstName!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lastName!: string;
  @IsString() @Matches(/^[0-9+()\-\s]{7,20}$/) phone!: string;
  @Transform(emptyToNull) @IsOptional() @IsEmail() @MaxLength(200) email?: string | null;
  @Transform(emptyToNull) @IsOptional() @IsDateString() dateOfBirth?: string | null;
  @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(100) emergencyName?: string | null;
  @Transform(emptyToNull) @IsOptional() @IsString() @Matches(/^[0-9+()\-\s]{7,20}$/) emergencyPhone?: string | null;
  @Transform(emptyToNull) @IsOptional() @IsEnum(Gender) gender?: Gender | null;
  @Transform(optionalNumber) @IsOptional() @IsInt() @Min(80) @Max(250) heightCm?: number | null;
  @Transform(optionalNumber) @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(20) @Max(400) weightKg?: number | null;
  @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(500) address?: string | null;
  @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(100) source?: string | null;
  @Transform(emptyToNull) @IsOptional() @IsDateString() joinedAt?: string | null;
  @IsOptional() @IsEnum(MemberStatus) status?: MemberStatus;
}

export class UpdateMemberDto {
  @IsOptional() @IsString() @IsNotEmpty() branchId?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) lastName?: string;
  @IsOptional() @IsString() @Matches(/^[0-9+()\-\s]{7,20}$/) phone?: string;
  @Transform(emptyToNull) @IsOptional() @IsEmail() @MaxLength(200) email?: string | null;
  @Transform(emptyToNull) @IsOptional() @IsDateString() dateOfBirth?: string | null;
  @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(100) emergencyName?: string | null;
  @Transform(emptyToNull) @IsOptional() @IsString() @Matches(/^[0-9+()\-\s]{7,20}$/) emergencyPhone?: string | null;
  @Transform(emptyToNull) @IsOptional() @IsEnum(Gender) gender?: Gender | null;
  @Transform(optionalNumber) @IsOptional() @IsInt() @Min(80) @Max(250) heightCm?: number | null;
  @Transform(optionalNumber) @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(20) @Max(400) weightKg?: number | null;
  @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(500) address?: string | null;
  @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(100) source?: string | null;
  @Transform(emptyToNull) @IsOptional() @IsDateString() joinedAt?: string | null;
  @IsOptional() @IsEnum(MemberStatus) status?: MemberStatus;
}

export class ListMembersQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsEnum(MemberStatus) status?: MemberStatus;
  @IsOptional() @IsString() branchId?: string;
  @Transform(({ value }) => value === true || value === "true") @IsOptional() @IsBoolean() includeArchived = false;
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}

export class AddMemberNoteDto {
  @IsString() @IsNotEmpty() @MaxLength(1000) body!: string;
}
