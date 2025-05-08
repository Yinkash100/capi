import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ description: 'Group name' })
  @IsString()
  @IsNotEmpty({ message: 'Group name is required' })
  name: string;

  @ApiProperty({ description: 'Group description', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}