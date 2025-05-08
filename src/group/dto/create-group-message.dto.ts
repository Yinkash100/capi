import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateGroupMessageDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty({ message: 'Message content is required' })
  content: string;

  @ApiProperty({ description: 'Group ID' })
  @IsUUID()
  @IsNotEmpty({ message: 'Group ID is required' })
  groupId: string;
}