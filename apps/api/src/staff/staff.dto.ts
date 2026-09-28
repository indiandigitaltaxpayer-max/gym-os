import { ArrayNotEmpty, IsArray, IsEmail, IsNotEmpty, IsString } from "class-validator";

export class InviteStaffDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() roleId!: string;
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) branchIds!: string[];
}

