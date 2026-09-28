import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from "class-validator";

export class LoginDto {
  @IsString() @IsNotEmpty() workspace!: string;
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() password!: string;
}

export class AcceptInvitationDto {
  @IsString() @IsNotEmpty() token!: string;
  @IsString() @MinLength(12) @Matches(/[A-Z]/, { message: "password must include an uppercase letter" })
  @Matches(/[a-z]/, { message: "password must include a lowercase letter" })
  @Matches(/[0-9]/, { message: "password must include a number" })
  password!: string;
}

