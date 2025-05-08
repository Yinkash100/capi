import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class LeaveGroupDto {
  @ApiProperty({ description: 'Group ID' })
  @IsUUID()
  @IsNotEmpty({ message: 'Group ID is required' })
  groupId: string;
}