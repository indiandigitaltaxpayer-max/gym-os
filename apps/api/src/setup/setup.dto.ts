import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";

export class CreateBranchDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() code!: string;
  @IsOptional() @IsString() address?: string;
}

export class CreatePlanDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsInt() @Min(1) durationDays!: number;
  @IsInt() @Min(0) priceMinor!: number;
  @IsOptional() @IsInt() @Min(0) taxRateBps?: number;
}

