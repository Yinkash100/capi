import { ApiProperty } from '@nestjs/swagger';
import { Message } from '@prisma/client';
import { IsString, IsNotEmpty } from 'class-validator';

export class MessageResponseDto {
    @ApiProperty()
      @IsString()
      @IsNotEmpty({ message: 'Message content is required' })
    id: string;
  
    @ApiProperty()
      @IsString()
      @IsNotEmpty({ message: 'Message content is required' })
    content: string;
  
    @ApiProperty()
      @IsString()
      @IsNotEmpty({ message: 'Message content is required' })
    read: boolean;
  
    @ApiProperty()
      @IsString()
      @IsNotEmpty({ message: 'Message content is required' })
    senderId: string;
  
    @ApiProperty()
      @IsString()
      @IsNotEmpty({ message: 'Message content is required' })
    receiverId: string;
  
    @ApiProperty()
      @IsString()
      @IsNotEmpty({ message: 'Message content is required' })
    createdAt: Date;
  
    constructor(message: Message) {
      this.id = message.id;
      this.content = message.content;
      this.read = message.read;
      this.senderId = message.senderId;
      this.receiverId = message.receiverId;
      this.createdAt = message.createdAt;
    }
  }