import { IsNotEmpty, IsString } from "class-validator";

export class CheckInDto {
  @IsString() @IsNotEmpty() memberId!: string;
  @IsString() @IsNotEmpty() branchId!: string;
}
