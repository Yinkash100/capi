import { ApiProperty } from '@nestjs/swagger';
import { GroupMessage } from '@prisma/client';

export class GroupMessageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  groupId: string;

  @ApiProperty()
  createdAt: Date;

  constructor(groupMessage: GroupMessage) {
    this.id = groupMessage.id;
    this.content = groupMessage.content;
    this.userId = groupMessage.userId;
    this.groupId = groupMessage.groupId;
    this.createdAt = groupMessage.createdAt;
  }
}