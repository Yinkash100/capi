import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty({ message: 'Message content is required' })
  content: string;

  @ApiProperty({ description: 'Receiver user ID' })
  @IsUUID()
  @IsNotEmpty({ message: 'Receiver ID is required' })
  receiverId: string;
}