import { NotificationKind, NotificationStatus } from "@gym/database";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class ListNotificationsQueryDto {
  @IsOptional() @IsEnum(NotificationStatus) status?: NotificationStatus;
  @IsOptional() @IsEnum(NotificationKind) kind?: NotificationKind;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

export class UpdateNotificationTemplateDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(2000) body?: string;
  @Transform(({ value }) => value === "" ? null : value) @IsOptional() @IsString() @MaxLength(200) providerTemplateName?: string | null;
  @IsOptional() @IsString() @MaxLength(20) locale?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateNotificationPolicyDto {
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5) @IsInt({ each: true }) @Min(1, { each: true }) @Max(30, { each: true }) renewalReminderDays?: number[];
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5) @IsInt({ each: true }) @Min(0, { each: true }) @Max(30, { each: true }) paymentReminderDays?: number[];
  @IsOptional() @IsBoolean() renewalEnabled?: boolean;
  @IsOptional() @IsBoolean() paymentEnabled?: boolean;
  @IsOptional() @IsBoolean() leadFollowUpEnabled?: boolean;
}

export class TestNotificationDto {
  @IsString() @IsNotEmpty() templateKey!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) recipientName!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) recipientAddress!: string;
  @IsOptional() @IsBoolean() simulateFailure = false;
}
