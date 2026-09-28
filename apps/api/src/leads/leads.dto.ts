import { LeadSource, LeadStage } from "@gym/database";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === "string" && value.trim() === "" ? null : value;

export class CreateLeadDto {
  @IsString() @IsNotEmpty() branchId!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) firstName!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lastName!: string;
  @IsString() @Matches(/^[0-9+()\-\s]{7,20}$/) phone!: string;
  @Transform(emptyToNull) @IsOptional() @IsEmail() @MaxLength(200) email?: string | null;
  @IsEnum(LeadSource) source!: LeadSource;
  @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(200) sourceDetail?: string | null;
  @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(1000) note?: string | null;
  @IsOptional() @IsString() assignedToUserId?: string;
}

export class UpdateLeadDto {
  @IsOptional() @IsString() @IsNotEmpty() branchId?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) lastName?: string;
  @IsOptional() @IsString() @Matches(/^[0-9+()\-\s]{7,20}$/) phone?: string;
  @Transform(emptyToNull) @IsOptional() @IsEmail() @MaxLength(200) email?: string | null;
  @IsOptional() @IsEnum(LeadSource) source?: LeadSource;
  @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(200) sourceDetail?: string | null;
}

export class ListLeadsQueryDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsEnum(LeadStage) stage?: LeadStage;
  @IsOptional() @IsEnum(LeadSource) source?: LeadSource;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() assignedToUserId?: string;
  @IsOptional() @IsIn(["DUE", "OVERDUE"]) due?: "DUE" | "OVERDUE";
  @Transform(({ value }) => value === true || value === "true") @IsOptional() @IsBoolean() includeArchived = false;
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

export class LeadSummaryQueryDto {
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class ChangeLeadStageDto {
  @IsEnum(LeadStage) stage!: LeadStage;
  @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(500) lossReason?: string | null;
}

export class AssignLeadDto {
  @IsString() @IsNotEmpty() assignedToUserId!: string;
}

export class AddLeadNoteDto {
  @IsString() @IsNotEmpty() @MaxLength(1000) body!: string;
}

export class CreateFollowUpDto {
  @IsDateString() dueAt!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) purpose!: string;
  @IsOptional() @IsString() assignedToUserId?: string;
}

export class CompleteFollowUpDto {
  @IsString() @IsNotEmpty() @MaxLength(1000) outcome!: string;
}

export class CancelFollowUpDto {
  @IsString() @IsNotEmpty() @MaxLength(1000) reason!: string;
}
