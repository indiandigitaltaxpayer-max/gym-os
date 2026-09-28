import { IsDateString, IsOptional, IsString, Matches } from "class-validator";

export class ReportQueryDto {
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}
