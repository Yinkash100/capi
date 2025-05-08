import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsEmail } from "class-validator";

export class CreateAdminDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsEmail({}, { message: 'Please provide a valid email' })
  email: string;

  @ApiProperty()
  @IsString()
  country: string;
}