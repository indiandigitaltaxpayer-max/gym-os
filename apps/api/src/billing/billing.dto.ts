import { PaymentMethod } from "@gym/database";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class ListInvoicesQueryDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsIn(["OPEN", "PARTIALLY_PAID", "PAID", "VOID", "OVERDUE"]) status?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

export class CapturePaymentDto {
  @IsString() @IsNotEmpty() invoiceId!: string;
  @IsInt() @Min(1) amountMinor!: number;
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsString() @IsNotEmpty() @MaxLength(120) idempotencyKey!: string;
  @IsOptional() @IsString() @MaxLength(120) providerRef?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsDateString() paidAt?: string;
}

export class BillingReasonDto {
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}
