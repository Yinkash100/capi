import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class JoinGroupDto {
  @ApiProperty({ description: 'Group ID' })
  @IsUUID()
  @IsNotEmpty({ message: 'Group ID is required' })
  groupId: string;
}